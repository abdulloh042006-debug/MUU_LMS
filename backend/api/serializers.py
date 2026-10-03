from pathlib import Path
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from .access import is_admin
from .models import User, Course, Assignment, Submission, Book, CalendarEvent, AttendanceSession, AttendanceRecord


def validate_upload(value):
    if value and value.size > 20 * 1024 * 1024:
        raise serializers.ValidationError('Fayl hajmi 20 MB dan oshmasin.')
    if value and Path(value.name).suffix.lower() not in {'.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.webp'}:
        raise serializers.ValidationError('PDF, Office, matn yoki rasm faylini yuklang.')
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
    submission_count = serializers.IntegerField(source='submissions.count', read_only=True)
    is_overdue = serializers.SerializerMethodField()

    def get_is_submitted(self, obj):
        return self.get_attempts_used(obj) > 0

    def get_attempts_used(self, obj):
        request = self.context.get('request')
        return obj.submissions.filter(student=request.user).count() if request else 0

    def get_is_overdue(self, obj):
        return obj.deadline < timezone.now()

    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_title', 'title', 'description', 'file', 'deadline', 'teacher', 'max_attempts', 'allow_late', 'created_at', 'updated_at', 'is_submitted', 'attempts_used', 'submission_count', 'is_overdue', 'course_archived']
        read_only_fields = ['teacher', 'created_at', 'updated_at']


class SubmissionSerializer(serializers.ModelSerializer):
    assignment = AssignmentSerializer(read_only=True)
    student_name = serializers.CharField(source='student.fullname', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    is_late = serializers.SerializerMethodField()

    def get_is_late(self, obj):
        return obj.submitted_at > obj.assignment.deadline

    def validate_file(self, value):
        return validate_upload(value)

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
        fields = ['id', 'student', 'student_name', 'status', 'note', 'session_topic', 'starts_at', 'course_title']


class AttendanceSessionSerializer(CourseScopedSerializer):
    class Meta:
        model = AttendanceSession
        fields = ['id', 'course', 'course_title', 'starts_at', 'topic']
