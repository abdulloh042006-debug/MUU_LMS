"""Course-scoped LMS workflows. All authorization runs on the server."""
import hashlib
import hmac
import math
import time
import json
import secrets
import string
import urllib.request
import urllib.parse
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import transaction
from django.db.models import Q, Max, Count
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.utils import get_md5_hash_password
from .access import TeacherOnly, AdminOnly, courses_for, scoped, is_admin, is_teacher
from .models import User, Course, Assignment, Submission, Book, CalendarEvent, AttendanceSession, AttendanceRecord, Notification
from .serializers import (LoginSerializer, UserProfileSerializer, AdminUserSerializer, ChangePasswordSerializer, AccountRecoverySerializer, CourseSerializer, AssignmentSerializer,
    SubmissionSerializer, GradeSerializer, BookSerializer, CalendarEventSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer, NotificationSerializer,
    CourseStudentSerializer, EmptySerializer, AttendanceCheckInSerializer, AttendanceManualMarkSerializer, AttendancePresenceSerializer, TelegramLinkSerializer)



REFRESH_COOKIE = 'lms-refresh'
ATTENDANCE_BUCKET_SECONDS = 5
ATTENDANCE_QR_MAX_AGE_SECONDS = 6
ATTENDANCE_QR_SIGNER = TimestampSigner(salt='muu-attendance-qr-v1')


def attendance_bucket(now=None):
    timestamp = (now or timezone.now()).timestamp()
    return int(timestamp // ATTENDANCE_BUCKET_SECONDS)


def make_qr_proof(session_id):
    bucket = attendance_bucket()
    return ATTENDANCE_QR_SIGNER.sign(f'{session_id}:{bucket}')


def validate_qr_proof(session_id, proof):
    try:
        payload = ATTENDANCE_QR_SIGNER.unsign(proof, max_age=ATTENDANCE_QR_MAX_AGE_SECONDS)
        signed_session, bucket = payload.split(':', 1)
        signed_session = int(signed_session)
        bucket = int(bucket)
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        raise ValidationError({'proof': 'QR kodi eskirgan yoki noto‘g‘ri.'})
    current = attendance_bucket()
    if signed_session != session_id or bucket not in (current, current - 1):
        raise ValidationError({'proof': 'QR kodi eskirgan yoki boshqa mashg‘ulotga tegishli.'})


def make_ultrasound_code(session_id, bucket=None):
    bucket = attendance_bucket() if bucket is None else bucket
    message = f'attendance:{session_id}:{bucket}'.encode()
    digest = hmac.new(str(settings.SECRET_KEY).encode(), message, hashlib.sha256).hexdigest()
    return f'{bucket & 0xff:02x}{digest[:6]}'


def validate_ultrasound_code(session_id, proof):
    proof = str(proof or '').strip().lower()
    current = attendance_bucket()
    valid = (
        make_ultrasound_code(session_id, current),
        make_ultrasound_code(session_id, current - 1),
    )
    if not any(hmac.compare_digest(proof, candidate) for candidate in valid):
        raise ValidationError({'proof': 'Ultrasound kodi eskirgan yoki noto‘g‘ri.'})


def distance_meters(lat1, lon1, lat2, lon2):
    earth_radius = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return earth_radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def validate_attendance_location(session, latitude, longitude, accuracy):
    if session.location_latitude is None or session.location_longitude is None:
        raise ValidationError('Bu mashg‘ulot uchun auditoriya lokatsiyasi belgilanmagan.')
    if accuracy > session.max_location_accuracy_m:
        raise ValidationError({
            'accuracy': f'Lokatsiya aniqligi yetarli emas ({round(accuracy)} m). Qayta urinib ko‘ring.'
        })
    distance = distance_meters(
        float(session.location_latitude),
        float(session.location_longitude),
        float(latitude),
        float(longitude),
    )
    if distance > session.location_radius_m:
        raise ValidationError({
            'location': f'Auditoriya hududidan tashqaridasiz ({round(distance)} m).'
        })
    return distance


def attendance_times(session):
    late_at = session.starts_at + timedelta(minutes=session.late_after_minutes)
    ends_at = session.starts_at + timedelta(minutes=session.attendance_minutes)
    return late_at, ends_at


def lesson_ends_at(session):
    if session.is_test_mode:
        return session.starts_at + timedelta(minutes=60)
    if session.calendar_event_id:
        return session.calendar_event.end_time
    return session.starts_at + timedelta(minutes=70)


def event_group_codes(event):
    raw = (getattr(event, 'for_group', '') or '').strip()
    if not raw or raw.lower() == 'all':
        return []
    return [part.strip().upper() for part in raw.split(',') if part.strip()]


def event_students(event):
    queryset = event.course.students.filter(is_active=True)
    groups = event_group_codes(event)
    if groups and queryset.exclude(group_code='').exists():
        queryset = queryset.filter(group_code__in=groups)
    return queryset


def attendance_students(session):
    if session.calendar_event_id:
        return event_students(session.calendar_event)
    return session.course.students.filter(is_active=True)


def sync_attendance_session(session, now=None):
    now = now or timezone.now()
    _, check_in_ends_at = attendance_times(session)
    if session.automated_checkin and now >= check_in_ends_at:
        existing_ids = set(session.records.values_list('student_id', flat=True))
        missing = attendance_students(session).exclude(pk__in=existing_ids)
        AttendanceRecord.objects.bulk_create([
            AttendanceRecord(
                session=session,
                student=student,
                status='absent',
                source='system',
                checked_at=check_in_ends_at,
                note='Davomat oynasi tugaganda avtomatik belgilandi.',
            )
            for student in missing
        ], ignore_conflicts=True)
    ends_at = lesson_ends_at(session)
    if now >= ends_at and session.ended_at is None:
        session.ended_at = ends_at
        session.save(update_fields=['ended_at'])
    return check_in_ends_at, ends_at


def set_refresh_cookie(response, token):
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Strict',
        path='/api/',
    )
    response['Cache-Control'] = 'no-store'
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE, path='/api/', samesite='Strict')
    response['Cache-Control'] = 'no-store'
    return response


def auth_response(user, status_code=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    response = Response({'access': str(refresh.access_token), 'must_change_password': user.must_change_password}, status=status_code)
    return set_refresh_cookie(response, str(refresh))


def notify_user(user, notification_type, title, message='', link=''):
    return Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        message=message,
        link=link,
    )


def notify_course_students(course, notification_type, title, message='', link=''):
    student_ids = list(course.students.values_list('id', flat=True))
    if not student_ids:
        return 0
    Notification.objects.bulk_create([
        Notification(
            user_id=student_id,
            type=notification_type,
            title=title,
            message=message,
            link=link,
        )
        for student_id in student_ids
    ])
    return len(student_ids)


class LoginAPIView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            return Response({'detail': 'Foydalanuvchi nomi yoki parol noto‘g‘ri.'}, status=401)
        if user.must_change_password and user.temporary_password_expires_at and user.temporary_password_expires_at <= timezone.now():
            return Response({'detail': 'Vaqtinchalik parol muddati tugagan. Yangi parol so‘rang.'}, status=401)
        return auth_response(user)


def validate_telegram_init_data(init_data):
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token:
        raise ValidationError('Telegram bot hali sozlanmagan.')
    pairs = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    supplied_hash = pairs.pop('hash', '')
    if not supplied_hash:
        raise ValidationError('Telegram imzosi topilmadi.')
    try:
        auth_date = int(pairs.get('auth_date', '0'))
    except ValueError:
        raise ValidationError('Telegram auth_date noto‘g‘ri.')
    now = int(time.time())
    if auth_date <= 0 or auth_date > now + 60 or now - auth_date > 600:
        raise ValidationError('Telegram sessiyasi eskirgan. Mini Appni qayta oching.')
    check_string = '\n'.join(f'{key}={pairs[key]}' for key in sorted(pairs))
    secret = hmac.new(b'WebAppData', token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, supplied_hash):
        raise ValidationError('Telegram imzosi noto‘g‘ri.')
    try:
        user_data = json.loads(pairs.get('user', '{}'))
        telegram_id = str(int(user_data['id']))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise ValidationError('Telegram foydalanuvchi ma’lumoti topilmadi.')
    return telegram_id


def normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if digits.startswith('998') and len(digits) == 12:
        return '+' + digits
    if len(digits) == 9:
        return '+998' + digits
    return '+' + digits if digits else ''


def make_temporary_password():
    alphabet = string.ascii_letters + string.digits
    return (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + '!'
        + ''.join(secrets.choice(alphabet) for _ in range(8))
    )


def send_telegram_message(chat_id, text):
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token or not chat_id:
        return False
    payload = json.dumps({
        'chat_id': str(chat_id),
        'text': text,
        'disable_web_page_preview': True,
    }).encode('utf-8')
    request = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/sendMessage',
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            body = json.loads(response.read().decode('utf-8'))
            return bool(body.get('ok'))
    except Exception:
        return False


class TelegramLinkAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TelegramLinkSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        telegram_id = validate_telegram_init_data(serializer.validated_data['init_data'])
        if User.objects.filter(telegram_chat_id=telegram_id).exclude(pk=request.user.pk).exists():
            raise ValidationError('Bu Telegram hisobi boshqa LMS hisobiga bog‘langan.')
        request.user.telegram_chat_id = telegram_id
        request.user.save(update_fields=['telegram_chat_id'])
        return Response({'telegram_connected': True})


class AccountRecoveryAPIView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = AccountRecoverySerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data['student_id']
        supplied_phone = normalize_phone(serializer.validated_data['phone_number'])
        user = User.objects.filter(student_id=student_id, is_active=True).first()

        if user and normalize_phone(user.phone_number) == supplied_phone and user.telegram_chat_id:
            temporary_password = make_temporary_password()
            sent = send_telegram_message(
                user.telegram_chat_id,
                (
                    'MU LMS hisobini tiklash\n\n'
                    f'Login: {user.username}\n'
                    f'Vaqtinchalik parol: {temporary_password}\n\n'
                    'Parol 15 daqiqa amal qiladi. Kirgach yangi parol o‘rnating.'
                ),
            )
            if sent:
                user.set_password(temporary_password)
                user.must_change_password = True
                user.temporary_password_expires_at = timezone.now() + timedelta(minutes=15)
                user.save(update_fields=['password', 'must_change_password', 'temporary_password_expires_at'])

        return Response({
            'detail': (
                'Ma’lumotlar mos bo‘lsa va Telegram hisobingiz oldindan '
                'bog‘langan bo‘lsa, login va vaqtinchalik parol bot orqali yuborildi.'
            )
        })


class CookieTokenRefreshAPIView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = EmptySerializer
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)
        if not token:
            return clear_refresh_cookie(Response({'detail': 'Session expired.'}, status=401))
        try:
            refresh = RefreshToken(token)
            user_id = refresh.get(api_settings.USER_ID_CLAIM)
            user = User.objects.filter(pk=user_id, is_active=True).first()
            if not user or refresh.get(api_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password):
                try:
                    refresh.blacklist()
                except TokenError:
                    pass
                return clear_refresh_cookie(Response({'detail': 'Session expired.'}, status=401))
            serializer = TokenRefreshSerializer(data={'refresh': token})
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return clear_refresh_cookie(Response({'detail': 'Session expired.'}, status=401))
        data = serializer.validated_data
        response = Response({'access': data['access']})
        if data.get('refresh'):
            set_refresh_cookie(response, data['refresh'])
        else:
            response['Cache-Control'] = 'no-store'
        return response


class LogoutAPIView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = EmptySerializer
    authentication_classes = []

    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        return clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))


class ProfileAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = request.COOKIES.get(REFRESH_COOKIE)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        return auth_response(user)


class AdminUserListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, AdminOnly]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.filter(role__in=['student', 'ustoz']).order_by('role', 'fullname')
        role = self.request.query_params.get('role')
        if role in {'student', 'ustoz'}:
            queryset = queryset.filter(role=role)
        if self.request.query_params.get('active') == '1':
            queryset = queryset.filter(is_active=True)
        return queryset


class AdminUserDetailAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, AdminOnly]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(role__in=['student', 'ustoz'])


class AdminStatsAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, AdminOnly]
    serializer_class = EmptySerializer

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate(now)
        return Response({
            'users_total': User.objects.filter(role__in=['student', 'ustoz']).count(),
            'students_active': User.objects.filter(role='student', is_active=True).count(),
            'teachers_active': User.objects.filter(role='ustoz', is_active=True).count(),
            'users_inactive': User.objects.filter(role__in=['student', 'ustoz'], is_active=False).count(),
            'courses_active': Course.objects.filter(is_archived=False).count(),
            'courses_archived': Course.objects.filter(is_archived=True).count(),
            'assignments_total': Assignment.objects.count(),
            'submissions_pending': Submission.objects.filter(grade=None).count(),
            'lessons_today': CalendarEvent.objects.filter(
                event_type='lesson',
                start_time__date=today,
            ).count(),
            'attendance_sessions_today': AttendanceSession.objects.filter(
                starts_at__date=today,
            ).count(),
        })


class CourseListAPIView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer

    def get_permissions(self):
        return [IsAuthenticated(), TeacherOnly()] if self.request.method == 'POST' else [IsAuthenticated()]

    def get_queryset(self):
        return courses_for(self.request.user).select_related('teacher').prefetch_related('students')

    def perform_create(self, serializer):
        serializer.save()


class CourseDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = CourseSerializer

    def get_permissions(self):
        return [IsAuthenticated(), TeacherOnly()] if self.request.method in ['PUT', 'PATCH'] else [IsAuthenticated()]

    def get_queryset(self):
        return courses_for(self.request.user).select_related('teacher').prefetch_related('students')


class CourseStudentsAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = CourseStudentSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_course(self, request, pk):
        return get_object_or_404(courses_for(request.user), pk=pk)

    def get(self, request, pk):
        course = self.get_course(request, pk)
        return Response(list(course.students.order_by('fullname').values('id', 'username', 'fullname', 'student_id', 'group_code', 'phone_number', 'is_active')))

    def post(self, request, pk):
        course = self.get_course(request, pk)
        if course.is_archived:
            raise ValidationError('Arxivlangan darsga talaba qo‘shilmaydi.')
        student = get_object_or_404(User, username=request.data.get('username'), role='student', is_active=True)
        course.students.add(student)
        notify_user(
            student,
            'course',
            'Darsga qo‘shildingiz',
            f'{course.code} — {course.title} darsi sizga biriktirildi.',
            '/my-courses',
        )
        return Response({'id': student.pk, 'fullname': student.fullname}, status=201)



class CourseStudentDetailAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = CourseStudentSerializer
    http_method_names = ['delete', 'options']

    def get_course(self, request, pk):
        return get_object_or_404(courses_for(request.user), pk=pk)

    def delete(self, request, pk, student_id):
        course = self.get_course(request, pk)
        student = get_object_or_404(course.students, pk=student_id)
        course.students.remove(student)
        return Response(status=204)


class CourseResourceMixin:
    permission_classes = [IsAuthenticated]
    owner_field = None
    model = None

    def get_permissions(self):
        permissions = [IsAuthenticated()]
        if self.request.method not in ['GET', 'HEAD', 'OPTIONS']:
            permissions.append(TeacherOnly())
        return permissions

    def get_queryset(self):
        qs = scoped(self.model.objects.all(), self.request.user, self.owner_field).select_related('course')
        if self.request.query_params.get('course'):
            try:
                course_id = int(self.request.query_params['course'])
            except (ValueError, TypeError):
                raise ValidationError({'course': 'Dars ID raqam bo‘lishi kerak.'})
            qs = qs.filter(course_id=course_id)
        return qs.order_by('-id')

    def perform_create(self, serializer):
        instance = serializer.save(**{self.owner_field: self.request.user})
        if not getattr(instance, 'course_id', None):
            return
        if isinstance(instance, Assignment):
            notify_course_students(
                instance.course,
                'assignment',
                'Yangi topshiriq',
                instance.title,
                f'/assignments/{instance.pk}',
            )
        elif isinstance(instance, Book):
            notify_course_students(
                instance.course,
                'material',
                'Yangi o‘quv materiali',
                instance.title,
                f'/courses?course={instance.course_id}',
            )
        elif isinstance(instance, CalendarEvent):
            notify_course_students(
                instance.course,
                'course',
                'Taqvimga yangi tadbir qo‘shildi',
                instance.title,
                '/calendar',
            )


class AssignmentListAPIView(CourseResourceMixin, generics.ListCreateAPIView):
    model = Assignment
    owner_field = 'teacher'
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        return super().get_queryset().annotate(
            submission_count_cached=Count('submissions', distinct=True),
            attempts_used_cached=Count(
                'submissions',
                filter=Q(submissions__student=self.request.user),
                distinct=True,
            ),
        )


class AssignmentDetailAPIView(CourseResourceMixin, generics.RetrieveUpdateDestroyAPIView):
    model = Assignment
    owner_field = 'teacher'
    serializer_class = AssignmentSerializer

    def perform_destroy(self, instance):
        if instance.submissions.exists():
            raise ValidationError('Javoblari mavjud topshiriq o‘chirilmaydi. Darsni arxivlang.')
        instance.delete()


class BookListAPIView(CourseResourceMixin, generics.ListCreateAPIView):
    model = Book
    owner_field = 'uploaded_by'
    serializer_class = BookSerializer


class BookDetailAPIView(CourseResourceMixin, generics.RetrieveUpdateDestroyAPIView):
    model = Book
    owner_field = 'uploaded_by'
    serializer_class = BookSerializer


class CalendarListAPIView(CourseResourceMixin, generics.ListCreateAPIView):
    model = CalendarEvent
    owner_field = 'created_by'
    serializer_class = CalendarEventSerializer


class CalendarDetailAPIView(CourseResourceMixin, generics.RetrieveUpdateDestroyAPIView):
    model = CalendarEvent
    owner_field = 'created_by'
    serializer_class = CalendarEventSerializer

    @transaction.atomic
    def perform_destroy(self, instance):
        # Attendance sessions protect their lesson event, so remove the linked
        # session first when a teacher deletes a lesson from the calendar.
        AttendanceSession.objects.filter(calendar_event=instance).delete()
        instance.delete()


class SubmissionAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionSerializer

    def assignment_for(self, request, pk):
        return get_object_or_404(scoped(Assignment.objects.all(), request.user, 'teacher'), pk=pk)

    def get(self, request, assignment_id):
        assignment = self.assignment_for(request, assignment_id)
        rows = assignment.submissions.select_related('student', 'assignment__course')
        if not is_teacher(request.user):
            rows = rows.filter(student=request.user)
        return Response(SubmissionSerializer(rows, many=True, context={'request': request}).data)

    @transaction.atomic
    def post(self, request, assignment_id):
        if request.user.role != 'student':
            raise PermissionDenied('Javobni faqat talaba yuboradi.')
        # Serializes concurrent attempts on PostgreSQL; the unique constraint is a second guard.
        assignment = get_object_or_404(Assignment.objects.select_for_update(), pk=assignment_id)
        if not assignment.course or not assignment.course.students.filter(pk=request.user.pk).exists():
            raise Http404()
        if assignment.course.is_archived:
            raise ValidationError('Bu dars arxivlangan.')
        if not assignment.allow_late and timezone.now() > assignment.deadline:
            raise ValidationError('Topshirish muddati tugagan.')
        last_attempt = assignment.submissions.filter(student=request.user).aggregate(value=Max('attempt'))['value'] or 0
        if last_attempt >= assignment.max_attempts:
            raise ValidationError('Yuborish urinishlari tugagan.')
        serializer = SubmissionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        submission = serializer.save(student=request.user, assignment=assignment, attempt=last_attempt + 1)
        notify_user(
            assignment.teacher,
            'submission',
            'Yangi topshiriq javobi',
            f'{request.user.fullname} — {assignment.title}',
            '/manage',
        )
        return Response(SubmissionSerializer(submission, context={'request': request}).data, status=201)


def submissions_for(user):
    qs = Submission.objects.select_related('student', 'assignment__course')
    if is_admin(user):
        return qs
    if user.role == 'ustoz':
        return qs.filter(Q(assignment__course__teacher=user) | Q(assignment__course__isnull=True, assignment__teacher=user))
    return qs.filter(student=user, assignment__course__students=user).distinct()


class MyGradesAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        return submissions_for(self.request.user).filter(student=self.request.user).exclude(grade=None)


class TeacherSubmissionsAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        qs = submissions_for(self.request.user)
        if self.request.query_params.get('course'):
            try:
                course_id = int(self.request.query_params['course'])
            except (ValueError, TypeError):
                raise ValidationError({'course': 'Dars ID raqam bo‘lishi kerak.'})
            qs = qs.filter(assignment__course_id=course_id)
        if self.request.query_params.get('pending') == '1':
            qs = qs.filter(grade=None)
        return qs


class GradeSetAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = GradeSerializer

    def post(self, request, submission_id):
        submission = get_object_or_404(submissions_for(request.user), pk=submission_id)
        serializer = GradeSerializer(submission, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(graded_at=timezone.now())
        notify_user(
            submission.student,
            'grade',
            'Topshiriq baholandi',
            f'{submission.assignment.title}: {submission.grade} / 100',
            '/grades',
        )
        return Response(SubmissionSerializer(submission, context={'request': request}).data)


class LessonAttendanceAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceSessionSerializer

    def get_event(self, request, event_id):
        return get_object_or_404(
            CalendarEvent.objects.select_related('course').filter(
                course__in=courses_for(request.user),
                event_type='lesson',
            ),
            pk=event_id,
        )

    def get(self, request, event_id):
        event = self.get_event(request, event_id)
        session = AttendanceSession.objects.filter(calendar_event=event).select_related('course', 'calendar_event').first()
        if not session:
            return Response({
                'event': CalendarEventSerializer(event, context={'request': request}).data,
                'session': None,
            })
        sync_attendance_session(session)
        session.refresh_from_db()
        return Response({
            'event': CalendarEventSerializer(event, context={'request': request}).data,
            'session': AttendanceSessionSerializer(session, context={'request': request}).data,
        })

    @transaction.atomic
    def post(self, request, event_id):
        event = self.get_event(request, event_id)
        now = timezone.now()
        test_mode = bool(request.data.get('test_mode'))
        if not test_mode and now < event.start_time - timedelta(minutes=10):
            raise ValidationError('Darsni boshlashga hali 10 daqiqadan ko‘p vaqt bor.')
        if not test_mode and now >= event.end_time:
            raise ValidationError('Bu dars vaqti tugagan.')
        try:
            latitude = float(request.data.get('latitude'))
            longitude = float(request.data.get('longitude'))
        except (TypeError, ValueError):
            raise ValidationError({'location': 'Darsni boshlash uchun auditoriya lokatsiyasini yoqing.'})
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise ValidationError({'location': 'Lokatsiya koordinatasi noto‘g‘ri.'})

        count = event_students(event).count()
        window = 60 if test_mode else min(60, 3 + max(0, (count - 1) // 30))
        late_after = max(1, min(window - 1, round(window * 0.6)))
        starts_at = now if test_mode or now >= event.start_time else event.start_time
        session, created = AttendanceSession.objects.get_or_create(
            calendar_event=event,
            defaults={
                'course': event.course,
                'starts_at': starts_at,
                'topic': event.title,
                'automated_checkin': True,
                'is_test_mode': test_mode,
                'attendance_minutes': window,
                'late_after_minutes': late_after,
                'location_latitude': latitude,
                'location_longitude': longitude,
                'location_radius_m': 80,
                'max_location_accuracy_m': 100,
            },
        )
        if not created:
            if test_mode:
                session.starts_at = now
                session.is_test_mode = True
                session.attendance_minutes = 60
                session.late_after_minutes = 36
                session.ended_at = None
                session.save(update_fields=['starts_at', 'is_test_mode', 'attendance_minutes', 'late_after_minutes', 'ended_at'])
            sync_attendance_session(session, now)
            update_fields = []
            if session.location_latitude is None:
                session.location_latitude = latitude
                update_fields.append('location_latitude')
            if session.location_longitude is None:
                session.location_longitude = longitude
                update_fields.append('location_longitude')
            if update_fields:
                session.save(update_fields=update_fields)
        return Response({
            'event': CalendarEventSerializer(event, context={'request': request}).data,
            'session': AttendanceSessionSerializer(session, context={'request': request}).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendanceListAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        qs = AttendanceSession.objects.filter(
            course__in=courses_for(self.request.user)
        ).select_related('course', 'calendar_event')
        now = timezone.now()
        for session in qs.filter(ended_at__isnull=True):
            sync_attendance_session(session, now)
        return qs


class AttendanceDetailAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceRecordSerializer

    def get_session(self, request, pk):
        return get_object_or_404(
            AttendanceSession.objects.filter(
                course__in=courses_for(request.user)
            ).select_related('course', 'calendar_event'),
            pk=pk,
        )

    def get(self, request, pk):
        session = self.get_session(request, pk)
        sync_attendance_session(session)
        return Response(
            AttendanceRecordSerializer(
                session.records.select_related('student', 'session__course', 'session__calendar_event'),
                many=True,
            ).data
        )

    @transaction.atomic
    def put(self, request, pk):
        session = self.get_session(request, pk)
        sync_attendance_session(session)
        AttendanceSession.objects.select_for_update().get(pk=session.pk)
        items = request.data.get('records')
        if not isinstance(items, list):
            raise ValidationError({'records': 'Ro‘yxat yuboring.'})
        serializer = AttendanceRecordSerializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)
        ids = [item['student'].pk for item in serializer.validated_data]
        if len(ids) != len(set(ids)) or attendance_students(session).filter(pk__in=ids).count() != len(ids):
            raise ValidationError('Faqat dars talabalarini bir martadan kiriting.')
        session.records.exclude(student_id__in=ids).delete()
        for item in serializer.validated_data:
            student = item.pop('student')
            AttendanceRecord.objects.update_or_create(
                session=session,
                student=student,
                defaults={
                    **item,
                    'source': 'manual',
                    'checked_at': timezone.now(),
                    'last_seen_at': timezone.now() if item['status'] in {'present', 'late'} else None,
                    'presence_samples': 1 if item['status'] in {'present', 'late'} else 0,
                    'distance_m': None,
                    'location_accuracy_m': None,
                },
            )
        return self.get(request, pk)


class AttendanceRosterAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = CourseStudentSerializer

    def get(self, request, pk):
        session = get_object_or_404(
            AttendanceSession.objects.select_related('course', 'calendar_event').filter(
                course__in=courses_for(request.user)
            ),
            pk=pk,
        )
        students = attendance_students(session).order_by('fullname')
        return Response(list(students.values(
            'id', 'username', 'fullname', 'student_id', 'group_code',
            'phone_number', 'is_active',
        )))


class AttendanceChallengeAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = EmptySerializer

    def get_session(self, request, pk):
        return get_object_or_404(
            AttendanceSession.objects.select_related('course', 'calendar_event').filter(
                course__in=courses_for(request.user)
            ),
            pk=pk,
        )

    def get(self, request, pk):
        session = self.get_session(request, pk)
        if not session.automated_checkin:
            raise ValidationError('Bu mashg‘ulotda avtomatik davomat yoqilmagan.')
        now = timezone.now()
        check_in_ends_at, session_ends_at = sync_attendance_session(session, now)
        session.refresh_from_db()
        if session.ended_at:
            raise ValidationError('Dars vaqti tugagan.')
        late_at, _ = attendance_times(session)
        return Response({
            'session': session.pk,
            'course': session.course_id,
            'course_code': session.course.code,
            'course_title': session.course.title,
            'topic': session.topic,
            'qr_proof': make_qr_proof(session.pk),
            'ultrasound_code': make_ultrasound_code(session.pk),
            'refresh_seconds': ATTENDANCE_BUCKET_SECONDS,
            'starts_at': session.starts_at,
            'late_after_at': late_at,
            'check_in_ends_at': check_in_ends_at,
            'lesson_ends_at': session_ends_at,
            'server_time': now,
            'is_open': session.starts_at - timedelta(seconds=30) <= now <= check_in_ends_at,
        })


class StudentActiveAttendanceAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    def get(self, request):
        if request.user.role != 'student':
            raise PermissionDenied('Bu endpoint faqat talabalar uchun.')
        now = timezone.now()
        sessions = AttendanceSession.objects.filter(
            course__students=request.user,
            course__is_archived=False,
            automated_checkin=True,
            ended_at__isnull=True,
            starts_at__lte=now + timedelta(seconds=30),
        ).select_related('course', 'calendar_event').order_by('-starts_at')[:20]
        result = []
        for session in sessions:
            if not attendance_students(session).filter(pk=request.user.pk).exists():
                continue
            check_in_ends_at, session_ends_at = sync_attendance_session(session, now)
            session.refresh_from_db()
            if session.ended_at or now > check_in_ends_at:
                continue
            late_at, _ = attendance_times(session)
            result.append({
                'id': session.pk,
                'course': session.course_id,
                'course_code': session.course.code,
                'course_title': session.course.title,
                'topic': session.topic,
                'starts_at': session.starts_at,
                'late_after_at': late_at,
                'check_in_ends_at': check_in_ends_at,
                'lesson_ends_at': session_ends_at,
                'attendance_minutes': session.attendance_minutes,
                'already_checked_in': session.records.filter(student=request.user).exists(),
            })
        return Response(result)


class AttendanceManualMarkAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceManualMarkSerializer

    @transaction.atomic
    def post(self, request, pk):
        session = get_object_or_404(
            AttendanceSession.objects.select_for_update().select_related('course', 'calendar_event').filter(
                course__in=courses_for(request.user)
            ),
            pk=pk,
        )
        sync_attendance_session(session)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        student = get_object_or_404(
            attendance_students(session),
            pk=data['student'],
        )
        record, _ = AttendanceRecord.objects.update_or_create(
            session=session,
            student=student,
            defaults={
                'status': data['status'],
                'note': data.get('note', ''),
                'source': 'manual',
                'checked_at': timezone.now(),
                'last_seen_at': timezone.now() if data['status'] in {'present', 'late'} else None,
                'presence_samples': 1 if data['status'] in {'present', 'late'} else 0,
                'distance_m': None,
                'location_accuracy_m': None,
            },
        )
        return Response(AttendanceRecordSerializer(record).data)


class AttendanceCheckInAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceCheckInSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'attendance'

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'student':
            raise PermissionDenied('Avtomatik davomatni faqat talaba tasdiqlaydi.')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        session = get_object_or_404(
            AttendanceSession.objects.select_for_update().select_related('course', 'calendar_event'),
            pk=data['session'],
            course__students=request.user,
            course__is_archived=False,
        )
        if not attendance_students(session).filter(pk=request.user.pk).exists():
            raise PermissionDenied('Siz bu dars guruhiga kirmaysiz.')
        if not session.automated_checkin:
            raise ValidationError('Bu mashg‘ulotda avtomatik davomat yoqilmagan.')

        now = timezone.now()
        check_in_ends_at, _ = sync_attendance_session(session, now)
        session.refresh_from_db()
        if session.ended_at:
            raise ValidationError('Dars vaqti tugagan.')
        late_at, _ = attendance_times(session)
        if now < session.starts_at - timedelta(seconds=30):
            raise ValidationError('Davomat hali boshlanmagan.')
        if now > check_in_ends_at:
            raise ValidationError('Davomat vaqti tugagan.')

        if data['channel'] == 'qr':
            validate_qr_proof(session.pk, data['proof'])
        else:
            validate_ultrasound_code(session.pk, data['proof'])

        distance = validate_attendance_location(
            session,
            data['latitude'],
            data['longitude'],
            data['accuracy'],
        )

        existing = session.records.filter(student=request.user).first()
        if existing and existing.source == 'manual':
            payload = AttendanceRecordSerializer(existing).data
            payload['already_checked_in'] = True
            payload['manual_override'] = True
            return Response(payload)

        check_status = 'late' if now > late_at else 'present'
        next_samples = (existing.presence_samples if existing else 0) + 1
        record, created = AttendanceRecord.objects.update_or_create(
            session=session,
            student=request.user,
            defaults={
                'status': check_status,
                'note': '',
                'source': data['channel'],
                'checked_at': existing.checked_at if existing and existing.checked_at else now,
                'last_seen_at': now,
                'presence_samples': next_samples,
                'presence_alerted_at': None,
                'distance_m': max(0, round(distance)),
                'location_accuracy_m': max(0, round(data['accuracy'])),
            },
        )
        payload = AttendanceRecordSerializer(record).data
        payload['already_checked_in'] = not created
        payload['manual_override'] = False
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendancePresenceAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendancePresenceSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'attendance'

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'student':
            raise PermissionDenied('Presence tasdiqlash faqat talabalar uchun.')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        session = get_object_or_404(
            AttendanceSession.objects.select_for_update().select_related('course', 'calendar_event'),
            pk=data['session'],
            course__students=request.user,
            course__is_archived=False,
        )
        if not attendance_students(session).filter(pk=request.user.pk).exists():
            raise PermissionDenied('Siz bu dars guruhiga kirmaysiz.')

        now = timezone.now()
        sync_attendance_session(session, now)
        session.refresh_from_db()
        if session.ended_at or now > lesson_ends_at(session):
            raise ValidationError('Dars vaqti tugagan.')
        if now < session.starts_at - timedelta(seconds=30):
            raise ValidationError('Dars hali boshlanmagan.')

        validate_ultrasound_code(session.pk, data['proof'])
        distance = validate_attendance_location(
            session,
            data['latitude'],
            data['longitude'],
            data['accuracy'],
        )
        record = get_object_or_404(
            session.records.select_for_update(),
            student=request.user,
            status__in=['present', 'late'],
        )
        record.last_seen_at = now
        record.presence_samples += 1
        record.presence_alerted_at = None
        record.distance_m = max(0, round(distance))
        record.location_accuracy_m = max(0, round(data['accuracy']))
        record.save(update_fields=[
            'last_seen_at', 'presence_samples', 'presence_alerted_at',
            'distance_m', 'location_accuracy_m',
        ])
        payload = AttendanceRecordSerializer(record).data
        payload['presence_confirmed'] = True
        return Response(payload)


class MyAttendanceAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceRecordSerializer

    def get_queryset(self):
        return AttendanceRecord.objects.filter(student=self.request.user, session__course__students=self.request.user).select_related('student', 'session__course', 'session__calendar_event').order_by('-session__starts_at')


class NotificationListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get('unread') == '1':
            queryset = queryset.filter(is_read=False)
        return queryset[:50]


class NotificationReadAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    def post(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'updated': updated})


class ProtectedMediaAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    def get(self, request, name):
        item = scoped(Book.objects.all(), request.user, 'uploaded_by').filter(file=name).first()
        item = item or scoped(Assignment.objects.all(), request.user, 'teacher').filter(file=name).first()
        item = item or submissions_for(request.user).filter(file=name).first()
        if not item or not item.file:
            raise Http404()
        try:
            response = FileResponse(item.file.open('rb'), as_attachment=True)
            response['Cache-Control'] = 'private, no-store'
            response['X-Content-Type-Options'] = 'nosniff'
            return response
        except FileNotFoundError:
            raise Http404()
