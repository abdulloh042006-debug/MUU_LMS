from datetime import timedelta
from pathlib import Path
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from .access import is_admin
from .models import User, Course, Assignment, Submission, Book, CalendarEvent, AttendanceSession, AttendanceRecord, Notification


SAFE_UPLOAD_EXTENSIONS = {'.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.zip'}
SAFE_SUBMISSION_EXTENSIONS = SAFE_UPLOAD_EXTENSIONS | {'.zip'}


def validate_upload(value, *, max_mb=20, allowed_extensions=SAFE_UPLOAD_EXTENSIONS):
    if not value:
        return value
    if value.size > max_mb * 1024 * 1024:
        raise serializers.ValidationError(f'Fayl hajmi {max_mb} MB dan oshmasin.')
    suffix = Path(value.name).suffix.lower()
    if suffix not in allowed_extensions:
        raise serializers.ValidationError('Bu fayl formati ruxsat etilmagan.')
    return value


class RegisterSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['fullname', 'username', 'email', 'password', 'confirm_password']
        extra_kwargs = {'password': {'write_only': True}, 'email': {'required': True, 'allow_blank': False}}

    def validate(self, data):
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Parollar bir xil emas.'})
        validate_password(data['password'], User(username=data['username'], fullname=data['fullname'], email=data.get('email', '')))
        return data

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'fullname', 'username', 'role', 'email', 'bio']
        read_only_fields = ['id', 'username', 'role']


class CourseStudentSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField()
    fullname = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)


class EmptySerializer(serializers.Serializer):
    pass


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        user = self.context['request'].user
        if not user.check_password(data['current_password']):
            raise serializers.ValidationError({'current_password': 'Joriy parol noto‘g‘ri.'})
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Yangi parollar bir xil emas.'})
        if data['current_password'] == data['new_password']:
            raise serializers.ValidationError({'new_password': 'Yangi parol joriy paroldan farq qilishi kerak.'})
        validate_password(data['new_password'], user)
        return data

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user


class CourseSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    student_count = serializers.IntegerField(source='students.count', read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'code', 'description', 'teacher', 'teacher_name', 'student_count', 'is_archived', 'created_at']
        read_only_fields = ['teacher', 'created_at']


class CourseScopedSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True, default='Eski material')

    def validate_course(self, value):
        if value is None:
            raise serializers.ValidationError('Kursni tanlang.')
        user = self.context['request'].user
        if not is_admin(user) and value.teacher_id != user.pk:
            raise serializers.ValidationError('Faqat o‘zingizning kursingizni tanlang.')
        if self.instance and self.instance.course_id and self.instance.course_id != value.pk:
            raise serializers.ValidationError('Mavjud yozuvni boshqa kursga ko‘chirish mumkin emas.')
        if value.is_archived and not self.instance:
            raise serializers.ValidationError('Arxivlangan kursga yangi yozuv qo‘shilmaydi.')
        return value

    def validate(self, data):
        if not self.instance and not data.get('course'):
            raise serializers.ValidationError({'course': 'Kursni tanlang.'})
        return data

    def validate_file(self, value):
        return validate_upload(value)


class AssignmentSerializer(CourseScopedSerializer):
    course_archived = serializers.BooleanField(source="course.is_archived", read_only=True, default=False)
    is_submitted = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    def get_is_submitted(self, obj) -> bool:
        return self.get_attempts_used(obj) > 0

    def get_attempts_used(self, obj) -> int:
        request = self.context.get('request')
        if not request or getattr(request.user, 'role', None) != 'student':
            return 0
        cached = getattr(obj, 'attempts_used_cached', None)
        if cached is not None:
            return cached
        return obj.submissions.filter(student=request.user).count()

    def get_submission_count(self, obj) -> int:
        cached = getattr(obj, 'submission_count_cached', None)
        return cached if cached is not None else obj.submissions.count()

    def get_is_overdue(self, obj) -> bool:
        return obj.deadline < timezone.now()

    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_title', 'title', 'description', 'file', 'deadline', 'teacher', 'max_attempts', 'allow_late', 'created_at', 'updated_at', 'is_submitted', 'attempts_used', 'submission_count', 'is_overdue', 'course_archived']
        read_only_fields = ['teacher', 'created_at', 'updated_at']


class SubmissionAssignmentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True, default='Eski topshiriq')

    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_title', 'title', 'deadline']


class SubmissionSerializer(serializers.ModelSerializer):
    assignment = SubmissionAssignmentSerializer(read_only=True)
    student_name = serializers.CharField(source='student.fullname', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    is_late = serializers.SerializerMethodField()

    def get_is_late(self, obj) -> bool:
        return obj.submitted_at > obj.assignment.deadline

    def validate_file(self, value):
        return validate_upload(value, max_mb=10, allowed_extensions=SAFE_SUBMISSION_EXTENSIONS)

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'student', 'student_name', 'student_username', 'file', 'submitted_at', 'grade', 'feedback', 'attempt', 'is_late']
        read_only_fields = ['assignment', 'student', 'submitted_at', 'grade', 'feedback', 'attempt']


class GradeSerializer(serializers.ModelSerializer):
    grade = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)

    class Meta:
        model = Submission
        fields = ['grade', 'feedback']


class BookSerializer(CourseScopedSerializer):
    class Meta:
        model = Book
        fields = ['id', 'course', 'course_title', 'title', 'subject', 'file', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']


class CalendarEventSerializer(CourseScopedSerializer):
    class Meta:
        model = CalendarEvent
        fields = ['id', 'course', 'course_title', 'title', 'description', 'event_type', 'start_time', 'end_time', 'created_by', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def validate(self, data):
        data = super().validate(data)
        start = data.get('start_time', getattr(self.instance, 'start_time', None))
        end = data.get('end_time', getattr(self.instance, 'end_time', None))
        if start and end and end <= start:
            raise serializers.ValidationError({'end_time': 'Tugash vaqti boshlanishdan keyin bo‘lsin.'})
        return data


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.fullname', read_only=True)
    session_topic = serializers.CharField(source='session.topic', read_only=True)
    starts_at = serializers.DateTimeField(source='session.starts_at', read_only=True)
    course_title = serializers.CharField(source='session.course.title', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'status', 'note', 'session_topic',
            'starts_at', 'course_title', 'source', 'checked_at', 'distance_m',
            'location_accuracy_m',
        ]
        read_only_fields = ['source', 'checked_at', 'distance_m', 'location_accuracy_m']


class AttendanceSessionSerializer(CourseScopedSerializer):
    check_in_ends_at = serializers.SerializerMethodField()
    late_after_at = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    def get_check_in_ends_at(self, obj):
        return obj.starts_at + timedelta(minutes=obj.attendance_minutes)

    def get_late_after_at(self, obj):
        return obj.starts_at + timedelta(minutes=obj.late_after_minutes)

    def get_student_count(self, obj):
        return obj.course.students.filter(is_active=True).count()

    def validate(self, data):
        data = super().validate(data)
        automated = data.get('automated_checkin', getattr(self.instance, 'automated_checkin', False))
        latitude = data.get('location_latitude', getattr(self.instance, 'location_latitude', None))
        longitude = data.get('location_longitude', getattr(self.instance, 'location_longitude', None))
        attendance_minutes = data.get('attendance_minutes', getattr(self.instance, 'attendance_minutes', None))
        late_after_minutes = data.get('late_after_minutes', getattr(self.instance, 'late_after_minutes', None))
        if automated and (latitude is None or longitude is None):
            raise serializers.ValidationError({'location_latitude': 'Avtomatik davomat uchun auditoriya lokatsiyasi kerak.'})
        if latitude is not None and not (-90 <= latitude <= 90):
            raise serializers.ValidationError({'location_latitude': 'Latitude -90 va 90 oralig?ida bo?lsin.'})
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError({'location_longitude': 'Longitude -180 va 180 oralig?ida bo?lsin.'})
        if attendance_minutes and late_after_minutes and late_after_minutes >= attendance_minutes:
            raise serializers.ValidationError({'late_after_minutes': 'Kechikish chegarasi davomat oynasidan kichik bo?lsin.'})
        return data

    def create(self, validated_data):
        course = validated_data['course']
        if 'attendance_minutes' not in validated_data:
            count = course.students.filter(is_active=True).count()
            validated_data['attendance_minutes'] = min(10, 3 + max(0, (count - 1) // 30))
        if 'late_after_minutes' not in validated_data:
            window = validated_data['attendance_minutes']
            validated_data['late_after_minutes'] = max(1, min(window - 1, round(window * 0.6)))
        return super().create(validated_data)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'course', 'course_title', 'starts_at', 'topic',
            'automated_checkin', 'attendance_minutes', 'late_after_minutes',
            'location_latitude', 'location_longitude', 'location_radius_m',
            'max_location_accuracy_m', 'ended_at', 'check_in_ends_at',
            'late_after_at', 'student_count',
        ]
        read_only_fields = ['ended_at']


class AttendanceCheckInSerializer(serializers.Serializer):
    session = serializers.IntegerField(min_value=1)
    channel = serializers.ChoiceField(choices=['qr', 'ultrasound'])
    proof = serializers.CharField(max_length=700)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy = serializers.FloatField(min_value=0, max_value=2000)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = fields
