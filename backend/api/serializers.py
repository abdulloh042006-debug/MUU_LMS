from datetime import datetime, timedelta
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


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserProfileSerializer(serializers.ModelSerializer):
    telegram_connected = serializers.SerializerMethodField()

    def get_telegram_connected(self, obj) -> bool:
        return bool(obj.telegram_chat_id)

    class Meta:
        model = User
        fields = [
            'id', 'fullname', 'username', 'role', 'email', 'bio',
            'student_id', 'group_code', 'phone_number', 'telegram_connected',
            'must_change_password',
        ]
        read_only_fields = [
            'id', 'username', 'role', 'student_id', 'group_code', 'phone_number',
            'telegram_connected', 'must_change_password',
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        trim_whitespace=False,
    )
    role = serializers.ChoiceField(
        choices=[('student', 'Talaba'), ('ustoz', 'Ustoz')],
    )

    class Meta:
        model = User
        fields = [
            'id', 'fullname', 'username', 'role', 'email', 'student_id',
            'group_code', 'phone_number', 'telegram_chat_id', 'is_active', 'must_change_password', 'password',
        ]
        read_only_fields = ['id', 'must_change_password']

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_student_id(self, value):
        if value is None:
            return None
        return value.strip() or None

    def validate_telegram_chat_id(self, value):
        if value is None:
            return None
        return value.strip() or None

    def validate_group_code(self, value):
        return (value or '').strip().upper()

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Boshlang‘ich parolni kiriting.'})
        return User.objects.create_user(
            password=password,
            must_change_password=True,
            **validated_data,
        )

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = True
            instance.temporary_password_expires_at = None
        instance.save()
        return instance


class TelegramLinkSerializer(serializers.Serializer):
    init_data = serializers.CharField(max_length=4096, trim_whitespace=False)


class AccountRecoverySerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=32)
    student_id = serializers.CharField(max_length=40)

    def validate_phone_number(self, value):
        digits = ''.join(ch for ch in value if ch.isdigit())
        if len(digits) < 9 or len(digits) > 15:
            raise serializers.ValidationError('Telefon raqam noto‘g‘ri.')
        return value.strip()

    def validate_student_id(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Talaba ID sini kiriting.')
        return value


class CourseStudentSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField()
    fullname = serializers.CharField(read_only=True)
    student_id = serializers.CharField(read_only=True, allow_null=True)
    group_code = serializers.CharField(read_only=True)
    phone_number = serializers.CharField(read_only=True)
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
        user.must_change_password = False
        user.temporary_password_expires_at = None
        user.save(update_fields=['password', 'must_change_password', 'temporary_password_expires_at'])
        return user


class CourseSerializer(serializers.ModelSerializer):
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='ustoz', is_active=True),
        required=False,
    )
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    student_count = serializers.IntegerField(source='students.count', read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'code', 'description', 'teacher', 'teacher_name', 'student_count', 'is_archived', 'created_at']
        read_only_fields = ['created_at']

    def validate(self, data):
        data = super().validate(data)
        request = self.context.get('request')
        if not request:
            return data
        user = request.user
        teacher = data.get('teacher')

        if self.instance is None:
            if is_admin(user):
                if not teacher:
                    raise serializers.ValidationError({'teacher': 'Ustozni tanlang.'})
            else:
                data['teacher'] = user
        elif 'teacher' in data and not is_admin(user):
            raise serializers.ValidationError({'teacher': 'Dars ustozini faqat administrator o‘zgartiradi.'})
        return data


class CourseScopedSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True, default='Eski material')

    def validate_course(self, value):
        if value is None:
            raise serializers.ValidationError('Darsni tanlang.')
        user = self.context['request'].user
        if not is_admin(user) and value.teacher_id != user.pk:
            raise serializers.ValidationError('Faqat o‘zingizning darsingizni tanlang.')
        if self.instance and self.instance.course_id and self.instance.course_id != value.pk:
            raise serializers.ValidationError('Mavjud yozuvni boshqa darsga ko‘chirish mumkin emas.')
        if value.is_archived and not self.instance:
            raise serializers.ValidationError('Arxivlangan darsga yangi yozuv qo‘shilmaydi.')
        return value

    def validate(self, data):
        if not self.instance and not data.get('course'):
            raise serializers.ValidationError({'course': 'Darsni tanlang.'})
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
        fields = ['id', 'assignment', 'student', 'student_name', 'student_username', 'file', 'submitted_at', 'grade', 'graded_at', 'feedback', 'attempt', 'is_late']
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
        fields = ['id', 'course', 'course_title', 'title', 'description', 'event_type', 'start_time', 'end_time', 'room', 'period', 'for_group', 'created_by', 'created_at']
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
    presence_state = serializers.SerializerMethodField()

    def get_presence_state(self, obj) -> str:
        if obj.status in {'absent', 'excused'}:
            return obj.status
        seen_at = obj.last_seen_at or obj.checked_at
        if not seen_at:
            return 'unknown'
        lesson_end = (
            obj.session.calendar_event.end_time
            if obj.session.calendar_event_id
            else obj.session.starts_at + timedelta(minutes=70)
        )
        if timezone.now() >= lesson_end:
            return 'finished'
        if timezone.now() - seen_at > timedelta(minutes=5):
            return 'stale'
        return 'confirmed'

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'status', 'note', 'session_topic',
            'starts_at', 'course_title', 'source', 'checked_at', 'last_seen_at',
            'presence_samples', 'presence_state', 'distance_m', 'location_accuracy_m',
        ]
        read_only_fields = [
            'source', 'checked_at', 'last_seen_at', 'presence_samples',
            'presence_state', 'distance_m', 'location_accuracy_m',
        ]


class AttendanceSessionSerializer(CourseScopedSerializer):
    check_in_ends_at = serializers.SerializerMethodField()
    late_after_at = serializers.SerializerMethodField()
    lesson_ends_at = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    def get_check_in_ends_at(self, obj) -> datetime:
        return obj.starts_at + timedelta(minutes=obj.attendance_minutes)

    def get_late_after_at(self, obj) -> datetime:
        return obj.starts_at + timedelta(minutes=obj.late_after_minutes)

    def get_lesson_ends_at(self, obj) -> datetime:
        if obj.calendar_event_id:
            return obj.calendar_event.end_time
        return obj.starts_at + timedelta(minutes=70)

    def get_student_count(self, obj) -> int:
        queryset = obj.course.students.filter(is_active=True)
        if obj.calendar_event_id:
            raw = (obj.calendar_event.for_group or '').strip()
            if raw and raw.lower() != 'all':
                groups = [part.strip().upper() for part in raw.split(',') if part.strip()]
                if groups and queryset.exclude(group_code='').exists():
                    queryset = queryset.filter(group_code__in=groups)
        return queryset.count()

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
            raise serializers.ValidationError({'location_latitude': 'Latitude -90 va 90 oralig‘ida bo‘lsin.'})
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError({'location_longitude': 'Longitude -180 va 180 oralig‘ida bo‘lsin.'})
        if attendance_minutes and late_after_minutes and late_after_minutes >= attendance_minutes:
            raise serializers.ValidationError({'late_after_minutes': 'Kechikish chegarasi davomat oynasidan kichik bo‘lsin.'})
        return data

    def create(self, validated_data):
        course = validated_data['course']
        if 'attendance_minutes' not in validated_data:
            count = course.students.filter(is_active=True).count()
            validated_data['attendance_minutes'] = 60
        if 'late_after_minutes' not in validated_data:
            window = validated_data['attendance_minutes']
            validated_data['late_after_minutes'] = max(1, min(window - 1, round(window * 0.6)))
        return super().create(validated_data)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'calendar_event', 'course', 'course_title', 'starts_at', 'topic',
            'automated_checkin', 'attendance_minutes', 'late_after_minutes',
            'location_latitude', 'location_longitude', 'location_radius_m',
            'max_location_accuracy_m', 'ended_at', 'check_in_ends_at',
            'late_after_at', 'lesson_ends_at', 'student_count',
        ]
        read_only_fields = ['ended_at', 'calendar_event']


class AttendanceCheckInSerializer(serializers.Serializer):
    session = serializers.IntegerField(min_value=1)
    channel = serializers.ChoiceField(choices=['qr', 'ultrasound', 'manual_code'])
    proof = serializers.CharField(max_length=700)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy = serializers.FloatField(min_value=0, max_value=2000)


class AttendanceManualMarkSerializer(serializers.Serializer):
    student = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=['present', 'late', 'absent', 'excused'])
    note = serializers.CharField(max_length=250, required=False, allow_blank=True)


class AttendancePresenceSerializer(serializers.Serializer):
    session = serializers.IntegerField(min_value=1)
    proof = serializers.CharField(max_length=100)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy = serializers.FloatField(min_value=0, max_value=2000)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = fields
