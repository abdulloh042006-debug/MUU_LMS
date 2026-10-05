"""Add reversible, account-wide sample content without changing existing LMS records."""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import (
    Assignment, AttendanceRecord, AttendanceSession, Book, CalendarEvent,
    Course, Notification, Submission, User,
)


class Command(BaseCommand):
    help = "Add shared demo lessons, materials, work, grades and attendance to all active LMS accounts."

    @transaction.atomic
    def handle(self, *args, **options):
        students = list(User.objects.filter(is_active=True, role="student").order_by("pk"))
        teachers = list(User.objects.filter(is_active=True, role="ustoz").order_by("pk"))
        if not students or not teachers:
            self.stdout.write("No active students or teachers; no data was added.")
            return

        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())
        tz = timezone.get_current_timezone()
        now = timezone.now()

        def at(day, hour, minute=0):
            return timezone.make_aware(
                datetime.combine(monday + timedelta(days=day), time(hour, minute)), tz
            )

        def notify(user, kind, title, message, link):
            Notification.objects.get_or_create(
                user=user, type=kind, title=title,
                defaults={"message": message, "link": link},
            )

        for teacher in teachers:
            code = f"DEMO-ALL-{teacher.pk}"
            course, _ = Course.objects.get_or_create(
                code=code,
                defaults={
                    "title": f"Umumiy demo dars — {teacher.fullname}",
                    "description": "Barcha talabalar uchun o‘quv tizimi imkoniyatlari sinovi.",
                    "teacher": teacher,
                },
            )
            if course.teacher_id != teacher.pk or course.is_archived:
                raise ValueError(f"{code} is not an active course owned by {teacher.username}")
            course.students.add(*students)

            for day, hour, minute, title, period in [
                (1, 8, 0, "Kirish va amaliy mashg‘ulot", 1),
                (2, 9, 20, "Guruh bilan ishlash", 2),
                (4, 10, 40, "Loyiha muhokamasi", 3),
                (8, 8, 0, "Keyingi hafta mashg‘uloti", 1),
            ]:
                start = at(day, hour, minute)
                CalendarEvent.objects.get_or_create(
                    course=course, created_by=teacher, title=f"{code}: {title}",
                    defaults={
                        "description": "Barcha faol talabalar uchun demo dars.",
                        "event_type": "lesson",
                        "start_time": start,
                        "end_time": start + timedelta(minutes=70),
                        "room": "Demo A-101",
                        "period": period,
                        "for_group": "All",
                    },
                )

            book, created = Book.objects.get_or_create(
                course=course, title=f"{code}: O‘quv qo‘llanma",
                defaults={"subject": "Umumiy amaliyot", "uploaded_by": teacher},
            )
            if created:
                book.file.save(
                    f"{code.lower()}_qollanma.txt",
                    ContentFile(
                        "Demo dars: o‘qish, topshiriq topshirish, baho, davomat va bildirishnomalar.\n".encode()
                    ),
                    save=True,
                )

            tasks = {}
            for title, days in [
                ("Baholangan amaliy ish", 7),
                ("Tekshirish uchun ish", 10),
                ("Yangi loyiha", 14),
            ]:
                assignment, _ = Assignment.objects.get_or_create(
                    course=course, title=f"{code}: {title}",
                    defaults={
                        "description": f"{title} — demo dars uchun matnli javob yuboring.",
                        "teacher": teacher,
                        "deadline": now + timedelta(days=days),
                        "max_attempts": 3,
                        "allow_late": False,
                    },
                )
                tasks[title] = assignment

            for index, student in enumerate(students):
                for title, grade in [
                    ("Baholangan amaliy ish", Decimal(82 + index % 15)),
                    ("Tekshirish uchun ish", None),
                ]:
                    assignment = tasks[title]
                    if Submission.objects.filter(
                        assignment=assignment, student=student, attempt=1
                    ).exists():
                        continue
                    submission = Submission(
                        assignment=assignment,
                        student=student,
                        attempt=1,
                        grade=grade,
                        graded_at=now - timedelta(days=1) if grade is not None else None,
                        feedback="Yaxshi bajarilgan demo ish." if grade is not None else "",
                    )
                    submission.file.save(
                        f"{code.lower()}_{student.pk}_{'grade' if grade is not None else 'pending'}.txt",
                        ContentFile(
                            f"{student.fullname}: {title} bo‘yicha sinov javobi.\n".encode()
                        ),
                        save=True,
                    )

                notify(
                    student, "course", f"{code}: darslar ochildi",
                    "Dars jadvali, material va topshiriqlar tayyor.", "/my-courses",
                )
                notify(
                    student, "grade", f"{code}: demo baho",
                    "Bahoni va ustoz izohini ko‘ring.", "/grades",
                )

            for index in range(1, 4):
                start = at(-index, 9, 20)
                session, _ = AttendanceSession.objects.get_or_create(
                    course=course, starts_at=start,
                    defaults={
                        "topic": f"{code}: o‘tgan dars {index}",
                        "automated_checkin": False,
                        "attendance_minutes": 4,
                        "late_after_minutes": 2,
                        "ended_at": start + timedelta(minutes=70),
                    },
                )
                for student_index, student in enumerate(students):
                    status = ("present", "late", "absent")[(student_index + index) % 3]
                    checked = start + timedelta(minutes=2) if status != "absent" else None
                    AttendanceRecord.objects.get_or_create(
                        session=session, student=student,
                        defaults={
                            "status": status,
                            "source": "manual",
                            "checked_at": checked,
                            "last_seen_at": checked,
                            "presence_samples": 1 if checked else 0,
                        },
                    )

            notify(
                teacher, "submission", f"{code}: javoblar keldi",
                "Demo talabalar ishlarini baholash navbatida ko‘ring.",
                f"/manage?tab=grading&course={course.pk}",
            )

        for admin in User.objects.filter(is_active=True, role="admin"):
            notify(
                admin, "system", "Demo ma’lumotlar tayyor",
                "Ustozlar, talabalar, kurslar va natijalarni boshqaruvda ko‘ring.",
                "/admin-panel",
            )

        self.stdout.write(self.style.SUCCESS(
            f"Shared demo ready: {len(students)} students, {len(teachers)} teachers, "
            f"{len(teachers)} courses, {4 * len(teachers)} lessons."
        ))
