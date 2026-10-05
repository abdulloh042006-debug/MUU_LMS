"""Shared authorization rules for every course-scoped endpoint."""
from django.db.models import Q
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Course


class LMSJWTAuthentication(JWTAuthentication):
    password_change_allowed_paths = {
        '/api/user/profile/',
        '/api/user/password/change/',
    }

    def authenticate(self, request):
        result = super().authenticate(request)
        if not result:
            return result
        user, token = result
        if user.must_change_password and request.path not in self.password_change_allowed_paths:
            raise AuthenticationFailed('Davom etishdan oldin vaqtinchalik parolni almashtiring.')
        return user, token


def is_admin(user):
    return user.is_authenticated and (user.is_superuser or user.role == 'admin')


def is_teacher(user):
    return user.is_authenticated and (is_admin(user) or user.role == 'ustoz')


class TeacherOnly(BasePermission):
    message = 'Bu amal faqat ustoz yoki administrator uchun.'

    def has_permission(self, request, view):
        return is_teacher(request.user)


class AdminOnly(BasePermission):
    message = 'Bu amal faqat administrator uchun.'

    def has_permission(self, request, view):
        return is_admin(request.user)


def courses_for(user):
    if is_admin(user):
        return Course.objects.all()
    if user.role == 'ustoz':
        return Course.objects.filter(teacher=user)
    return Course.objects.filter(students=user)


def scoped(queryset, user, owner_field):
    if is_admin(user):
        return queryset
    # Legacy records without a course are private to their owner until migrated.
    if user.role == 'ustoz':
        return queryset.filter(Q(course__teacher=user) | Q(**{'course__isnull': True, owner_field: user}))
    return queryset.filter(course__students=user).distinct()
