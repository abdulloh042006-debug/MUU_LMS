from django.contrib import admin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from .models import User, Assignment, Submission, Book, CalendarEvent, Course, AttendanceSession, AttendanceRecord

class LMSUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('username', 'fullname', 'email', 'role')

class LMSUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'

class UserAdmin(DefaultUserAdmin):
    form = LMSUserChangeForm
    add_form = LMSUserCreationForm
    ordering = ('username',)
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Profile', {'fields': ('fullname', 'email', 'bio', 'birthday_date', 'gender', 'address', 'temporarily_address')}),
        ('Access', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login',)}),
    )
    add_fieldsets = ((None, {'fields': ('username', 'fullname', 'email', 'role', 'password1', 'password2')}),)

    list_display = ('id', 'fullname', 'username', 'role', 'gender', 'birthday_date')
    search_fields = ('fullname', 'username')
    list_filter = ('role', 'gender')

class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'teacher', 'deadline')
    search_fields = ('title',)
    list_filter = ('teacher',)

class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'assignment', 'student', 'submitted_at', 'grade', 'attempt')
    search_fields = ('assignment__title', 'student__fullname')
    list_filter = ('assignment',)

class BookAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'subject', 'uploaded_by')
    search_fields = ('title', 'subject')
    list_filter = ('subject',)

class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'event_type', 'start_time', 'end_time', 'created_by')
    search_fields = ('title',)
    list_filter = ('event_type',)

admin.site.register(User, UserAdmin)
admin.site.register(Assignment, AssignmentAdmin)
admin.site.register(Submission, SubmissionAdmin)
admin.site.register(Book, BookAdmin)
admin.site.register(CalendarEvent, CalendarEventAdmin)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "teacher", "is_archived")
    filter_horizontal = ("students",)
    search_fields = ("code", "title")

admin.site.register(AttendanceSession)
admin.site.register(AttendanceRecord)
