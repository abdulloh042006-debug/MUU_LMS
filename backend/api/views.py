"""Course-scoped LMS workflows. All authorization runs on the server."""
import hashlib
import hmac
import math
import time
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
from .access import TeacherOnly, courses_for, scoped, is_admin, is_teacher
from .models import User, Course, Assignment, Submission, Book, CalendarEvent, AttendanceSession, AttendanceRecord, Notification
from .serializers import (RegisterSerializer, LoginSerializer, UserProfileSerializer, ChangePasswordSerializer, CourseSerializer, AssignmentSerializer,
    SubmissionSerializer, GradeSerializer, BookSerializer, CalendarEventSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer, NotificationSerializer,
    CourseStudentSerializer, EmptySerializer, AttendanceCheckInSerializer)



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
        raise ValidationError({'proof': 'QR kodi eskirgan yoki noto?g?ri.'})
    current = attendance_bucket()
    if signed_session != session_id or bucket not in (current, current - 1):
        raise ValidationError({'proof': 'QR kodi eskirgan yoki boshqa mashg?ulotga tegishli.'})


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
        raise ValidationError({'proof': 'Ultrasound kodi eskirgan yoki noto?g?ri.'})


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
        raise ValidationError('Bu mashg?ulot uchun auditoriya lokatsiyasi belgilanmagan.')
    if accuracy > session.max_location_accuracy_m:
        raise ValidationError({
            'accuracy': f'Lokatsiya aniqligi yetarli emas ({round(accuracy)} m). Qayta urinib ko?ring.'
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
    response = Response({'access': str(refresh.access_token)}, status=status_code)
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


class RegisterAPIView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return auth_response(user, status.HTTP_201_CREATED)


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
        return auth_response(user)


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


class CourseListAPIView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer

    def get_permissions(self):
        return [IsAuthenticated(), TeacherOnly()] if self.request.method == 'POST' else [IsAuthenticated()]

    def get_queryset(self):
        return courses_for(self.request.user).select_related('teacher').prefetch_related('students')

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


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
        return Response(list(course.students.order_by('fullname').values('id', 'username', 'fullname', 'is_active')))

    def post(self, request, pk):
        course = self.get_course(request, pk)
        if course.is_archived:
            raise ValidationError('Arxivlangan kursga talaba qo‘shilmaydi.')
        student = get_object_or_404(User, username=request.data.get('username'), role='student', is_active=True)
        course.students.add(student)
        notify_user(
            student,
            'course',
            'Kursga qo‘shildingiz',
            f'{course.code} — {course.title} kursi sizga biriktirildi.',
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
                raise ValidationError({'course': 'Kurs ID raqam bo‘lishi kerak.'})
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
            raise ValidationError('Javoblari mavjud topshiriq o‘chirilmaydi. Kursni arxivlang.')
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
            raise ValidationError('Bu kurs arxivlangan.')
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
                raise ValidationError({'course': 'Kurs ID raqam bo‘lishi kerak.'})
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
        serializer.save()
        notify_user(
            submission.student,
            'grade',
            'Topshiriq baholandi',
            f'{submission.assignment.title}: {submission.grade} / 100',
            '/grades',
        )
        return Response(SubmissionSerializer(submission, context={'request': request}).data)


class AttendanceListAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        return AttendanceSession.objects.filter(course__in=courses_for(self.request.user)).select_related('course')


class AttendanceDetailAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceRecordSerializer

    def get_session(self, request, pk):
        return get_object_or_404(AttendanceSession.objects.filter(course__in=courses_for(request.user)), pk=pk)

    def get(self, request, pk):
        session = self.get_session(request, pk)
        return Response(AttendanceRecordSerializer(session.records.select_related('student', 'session__course'), many=True).data)

    @transaction.atomic
    def put(self, request, pk):
        session = self.get_session(request, pk)
        # Lock one session so two teacher saves cannot interleave.
        AttendanceSession.objects.select_for_update().get(pk=session.pk)
        items = request.data.get('records')
        if not isinstance(items, list):
            raise ValidationError({'records': 'Ro‘yxat yuboring.'})
        serializer = AttendanceRecordSerializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)
        ids = [item['student'].pk for item in serializer.validated_data]
        if len(ids) != len(set(ids)) or session.course.students.filter(pk__in=ids).count() != len(ids):
            raise ValidationError('Faqat kurs talabalarini bir martadan kiriting.')
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
                    'distance_m': None,
                    'location_accuracy_m': None,
                },
            )
        return self.get(request, pk)


class AttendanceChallengeAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = EmptySerializer

    def get_session(self, request, pk):
        return get_object_or_404(
            AttendanceSession.objects.select_related('course').filter(
                course__in=courses_for(request.user)
            ),
            pk=pk,
        )

    def get(self, request, pk):
        session = self.get_session(request, pk)
        if not session.automated_checkin:
            raise ValidationError('Bu mashg?ulotda avtomatik davomat yoqilmagan.')
        if session.ended_at:
            raise ValidationError('Davomat yakunlangan.')
        late_at, ends_at = attendance_times(session)
        now = timezone.now()
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
            'check_in_ends_at': ends_at,
            'server_time': now,
            'is_open': session.starts_at - timedelta(seconds=30) <= now <= ends_at,
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
        ).select_related('course').order_by('-starts_at')[:20]
        result = []
        for session in sessions:
            late_at, ends_at = attendance_times(session)
            if now > ends_at:
                continue
            result.append({
                'id': session.pk,
                'course': session.course_id,
                'course_code': session.course.code,
                'course_title': session.course.title,
                'topic': session.topic,
                'starts_at': session.starts_at,
                'late_after_at': late_at,
                'check_in_ends_at': ends_at,
                'attendance_minutes': session.attendance_minutes,
                'already_checked_in': session.records.filter(student=request.user).exists(),
            })
        return Response(result)


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
            AttendanceSession.objects.select_for_update().select_related('course'),
            pk=data['session'],
            course__students=request.user,
            course__is_archived=False,
        )
        if not session.automated_checkin:
            raise ValidationError('Bu mashg?ulotda avtomatik davomat yoqilmagan.')
        if session.ended_at:
            raise ValidationError('Davomat yakunlangan.')

        now = timezone.now()
        late_at, ends_at = attendance_times(session)
        if now < session.starts_at - timedelta(seconds=30):
            raise ValidationError('Davomat hali boshlanmagan.')
        if now > ends_at:
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
        record, created = AttendanceRecord.objects.update_or_create(
            session=session,
            student=request.user,
            defaults={
                'status': check_status,
                'note': '',
                'source': data['channel'],
                'checked_at': now,
                'distance_m': max(0, round(distance)),
                'location_accuracy_m': max(0, round(data['accuracy'])),
            },
        )
        payload = AttendanceRecordSerializer(record).data
        payload['already_checked_in'] = not created
        payload['manual_override'] = False
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendanceFinalizeAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = EmptySerializer

    @transaction.atomic
    def post(self, request, pk):
        session = get_object_or_404(
            AttendanceSession.objects.select_for_update().select_related('course').filter(
                course__in=courses_for(request.user)
            ),
            pk=pk,
        )
        now = timezone.now()
        existing_ids = set(session.records.values_list('student_id', flat=True))
        missing = session.course.students.filter(is_active=True).exclude(pk__in=existing_ids)
        AttendanceRecord.objects.bulk_create([
            AttendanceRecord(
                session=session,
                student=student,
                status='absent',
                source='system',
                checked_at=now,
                note='Davomat oynasi yakunlanganda avtomatik belgilandi.',
            )
            for student in missing
        ])
        session.ended_at = now
        session.save(update_fields=['ended_at'])
        records = session.records.select_related('student', 'session__course').order_by('student__fullname')
        return Response({
            'ended_at': session.ended_at,
            'records': AttendanceRecordSerializer(records, many=True).data,
        })


class MyAttendanceAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceRecordSerializer

    def get_queryset(self):
        return AttendanceRecord.objects.filter(student=self.request.user, session__course__students=self.request.user).select_related('student', 'session__course').order_by('-session__starts_at')


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
