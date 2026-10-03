"""Course-scoped LMS workflows. All authorization runs on the server."""
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Max
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
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .access import TeacherOnly, courses_for, scoped, is_admin, is_teacher
from .models import User, Course, Assignment, Submission, Book, CalendarEvent, AttendanceSession, AttendanceRecord
from .serializers import (RegisterSerializer, LoginSerializer, UserProfileSerializer, CourseSerializer, AssignmentSerializer,
    SubmissionSerializer, GradeSerializer, BookSerializer, CalendarEventSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer)


REFRESH_COOKIE = 'lms-refresh'


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


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
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


class CookieTokenRefreshAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)
        if not token:
            return clear_refresh_cookie(Response({'detail': 'Session expired.'}, status=401))
        serializer = TokenRefreshSerializer(data={'refresh': token})
        try:
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


class LogoutAPIView(APIView):
    permission_classes = [AllowAny]
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


class CourseStudentsAPIView(APIView):
    permission_classes = [IsAuthenticated, TeacherOnly]

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
        return Response({'id': student.pk, 'fullname': student.fullname}, status=201)

    def delete(self, request, pk, student_id=None):
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
        serializer.save(**{self.owner_field: self.request.user})


class AssignmentListAPIView(CourseResourceMixin, generics.ListCreateAPIView):
    model = Assignment
    owner_field = 'teacher'
    serializer_class = AssignmentSerializer


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


class SubmissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

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
        serializer.save(student=request.user, assignment=assignment, attempt=last_attempt + 1)
        return Response(serializer.data, status=201)


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


class GradeSetAPIView(APIView):
    permission_classes = [IsAuthenticated, TeacherOnly]

    def post(self, request, submission_id):
        submission = get_object_or_404(submissions_for(request.user), pk=submission_id)
        serializer = GradeSerializer(submission, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SubmissionSerializer(submission, context={'request': request}).data)


class AttendanceListAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, TeacherOnly]
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        return AttendanceSession.objects.filter(course__in=courses_for(self.request.user)).select_related('course')


class AttendanceDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, TeacherOnly]

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
            AttendanceRecord.objects.update_or_create(session=session, student=student, defaults=item)
        return self.get(request, pk)


class MyAttendanceAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceRecordSerializer

    def get_queryset(self):
        return AttendanceRecord.objects.filter(student=self.request.user, session__course__students=self.request.user).select_related('student', 'session__course').order_by('-session__starts_at')


class ProtectedMediaAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, name):
        item = scoped(Book.objects.all(), request.user, 'uploaded_by').filter(file=name).first()
        item = item or scoped(Assignment.objects.all(), request.user, 'teacher').filter(file=name).first()
        item = item or submissions_for(request.user).filter(file=name).first()
        if not item or not item.file:
            raise Http404()
        try:
            response = FileResponse(item.file.open('rb'), as_attachment=True)
            response['Cache-Control'] = 'private, no-store'
            return response
        except FileNotFoundError:
            raise Http404()
