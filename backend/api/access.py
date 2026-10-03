"""Shared authorization rules for every course-scoped endpoint."""
from django.db.models import Q
from rest_framework.permissions import BasePermission
from .models import Course


def is_admin(user):
    return user.is_authenticated and (user.is_superuser or user.role == 'admin')


def is_teacher(user):
    return user.is_authenticated and (is_admin(user) or user.role == 'ustoz')


class TeacherOnly(BasePermission):
    message = 'Bu amal faqat ustoz yoki administrator uchun.'

    def has_permission(self, request, view):
        return is_teacher(request.user)


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
