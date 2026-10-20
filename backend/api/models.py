from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from .managers import UserManager

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('ustoz', 'Ustoz'),  # noqa
        ('admin', 'Admin')
    ]
    GENDER_CHOICES = [
        ('erkak', 'Erkak'),  # noqa
        ('ayol', 'Ayol')  # noqa
    ]

    email = models.EmailField(blank=True)
    bio = models.TextField(blank=True)
    fullname = models.CharField(max_length=50, null=False)
    username = models.CharField(max_length=50, unique=True, null=False)
    student_id = models.CharField(max_length=40, unique=True, null=True, blank=True)
    group_code = models.CharField(max_length=40, blank=True, db_index=True)
    phone_number = models.CharField(max_length=32, blank=True, db_index=True)
    telegram_chat_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    must_change_password = models.BooleanField(default=False)
    temporary_password_expires_at = models.DateTimeField(null=True, blank=True)
    birthday_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=False)
    address = models.CharField(max_length=50, null=False)
    temporarily_address = models.CharField(max_length=100, null=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['fullname']

    def __str__(self):
        return self.fullname
    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'


class Course(models.Model):
    title = models.CharField(max_length=150)
    code = models.CharField(max_length=32, unique=True)
    description = models.TextField(blank=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='courses_taught')
    students = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='enrolled_courses', blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return f'{self.code} — {self.title}'


class Assignment(models.Model):
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.PROTECT, related_name='assignments')
    max_attempts = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(10)])
    allow_late = models.BooleanField(default=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    file = models.FileField(upload_to='assignments/', blank=True, null=True)
    deadline = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments')

    def __str__(self):
        return self.title

class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submissions')
    file = models.FileField(upload_to='submissions/')
    submitted_at = models.DateTimeField(auto_now_add=True)
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)
    attempt = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ['-submitted_at', '-id']
        constraints = [models.UniqueConstraint(fields=['assignment', 'student', 'attempt'], name='unique_submission_attempt')]

    def __str__(self):
        return f"{self.assignment.title} - {self.student.fullname}"

class Book(models.Model):
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.PROTECT, related_name='books')
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=100)
    file = models.FileField(upload_to='books/')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_books')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class CalendarEvent(models.Model):
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.PROTECT, related_name='events')
    EVENT_TYPE_CHOICES = [
        ('lesson', 'Dars'),
        ('assignment_deadline', 'Topshiriq dedlayni'),
        ('exam', 'Imtihon'),
        ('other', 'Boshqa')
    ]
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=32, choices=EVENT_TYPE_CHOICES, default='lesson')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    room = models.CharField(max_length=50, blank=True)
    period = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)])
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='events')
    created_at = models.DateTimeField(auto_now_add=True)
    # optional: specific group or user
    for_group = models.CharField(max_length=100, blank=True, null=True)  # masalan, "10A" yoki "All"

    def __str__(self):
        return f"{self.title} ({self.get_event_type_display()})"

class AttendanceSession(models.Model):
    calendar_event = models.OneToOneField(CalendarEvent, null=True, blank=True, on_delete=models.PROTECT, related_name='attendance_session')
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='attendance_sessions')
    starts_at = models.DateTimeField()
    topic = models.CharField(max_length=200)
    automated_checkin = models.BooleanField(default=False)
    attendance_minutes = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(2), MaxValueValidator(15)])
    late_after_minutes = models.PositiveSmallIntegerField(default=2, validators=[MinValueValidator(1), MaxValueValidator(14)])
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_radius_m = models.PositiveSmallIntegerField(default=80, validators=[MinValueValidator(10), MaxValueValidator(500)])
    max_location_accuracy_m = models.PositiveSmallIntegerField(default=100, validators=[MinValueValidator(5), MaxValueValidator(500)])
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-starts_at']
        constraints = [models.UniqueConstraint(fields=['course', 'starts_at'], name='unique_course_session')]


class AttendanceRecord(models.Model):
    STATUS_CHOICES = [('present', 'Qatnashdi'), ('absent', 'Qatnashmadi'), ('late', 'Kechikdi'), ('excused', 'Sababli')]
    SOURCE_CHOICES = [('manual', 'Qo‘lda'), ('qr', 'QR'), ('ultrasound', 'Ultrasound'), ('system', 'Tizim')]
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='attendance_records')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES)
    note = models.CharField(max_length=250, blank=True)
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default='manual')
    checked_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    presence_samples = models.PositiveIntegerField(default=0)
    presence_alerted_at = models.DateTimeField(null=True, blank=True)
    distance_m = models.PositiveIntegerField(null=True, blank=True)
    location_accuracy_m = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['session', 'student'], name='unique_attendance_record')]


class Notification(models.Model):
    TYPE_CHOICES = [
        ('grade', 'Baho'),
        ('assignment', 'Topshiriq'),
        ('material', 'Material'),
        ('submission', 'Javob'),
        ('attendance', 'Davomat'),
        ('course', 'Kurs'),
        ('system', 'Tizim'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at'], name='notif_user_read_created_idx'),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.title}'
