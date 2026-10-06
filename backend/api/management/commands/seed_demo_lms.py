from datetime import datetime, time, timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import (
    Assignment,
    AttendanceRecord,
    AttendanceSession,
    Book,
    CalendarEvent,
    Course,
    Notification,
    Submission,
    User,
)


class Command(BaseCommand):
    help = "Create connected local demo data for MU LMS development."

    DEMO_PASSWORDS = {
        "admin_demo": "AdminDemo!2026",
        "ustoz_demo": "UstozDemo!2026",
        "talaba_demo": "TalabaDemo!2026",
    }

    def handle(self, *args, **options):
        admin, _ = User.objects.get_or_create(
            username="admin_demo",
            defaults={
                "fullname": "Demo Administrator",
                "role": "admin",
                "email": "admin@demo.local",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.fullname = "Demo Administrator"
        admin.role = "admin"
        admin.is_active = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(self.DEMO_PASSWORDS["admin_demo"])
        admin.save()

        teacher, _ = User.objects.get_or_create(
            username="ustoz_demo",
            defaults={
                "fullname": "Demo Ustoz",
                "role": "ustoz",
                "email": "ustoz@demo.local",
            },
        )
        teacher.fullname = "Demo Ustoz"
        teacher.role = "ustoz"
        teacher.is_active = True
        teacher.set_password(self.DEMO_PASSWORDS["ustoz_demo"])
        teacher.save()

        names = [
            ("talaba_demo", "Demo Talaba"),
            ("azizbek.a", "Aliyev Azizbek"),
            ("nilufar.k", "Karimova Nilufar"),
            ("akmal.r", "Rasulov Akmal"),
            ("madina.s", "Sodiqova Madina"),
            ("oybek.t", "Tursunov Oybek"),
            ("mohira.y", "Yusupova Mohira"),
            ("asadbek.b", "Bozorov Asadbek"),
            ("sevinch.d", "Daminova Sevinch"),
            ("mirjalol.e", "Eshmurodov Mirjalol"),
            ("aziza.s", "Salimova Aziza"),
            ("jamshid.n", "Norqulov Jamshid"),
            ("mohichehra.a", "Abdullayeva Mohichehra"),
            ("sardor.m", "Mamatqulov Sardor"),
            ("zarnigor.h", "Hasanova Zarnigor"),
            ("bekzod.q", "Qodirov Bekzod"),
            ("shahnoza.i", "Ismoilova Shahnoza"),
            ("umidjon.s", "Sobirov Umidjon"),
            ("malika.r", "Rahimova Malika"),
            ("diyorbek.o", "Ortiqov Diyorbek"),
            ("munisa.a", "Abdurahmonova Munisa"),
            ("jahongir.t", "Toshpo‘latov Jahongir"),
            ("sarvinoz.y", "Yoqubova Sarvinoz"),
            ("shoxrux.k", "Karimov Shoxrux"),
        ]

        students = []
        for index, (username, fullname) in enumerate(names, start=1):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "fullname": fullname,
                    "role": "student",
                    "email": f"{username}@demo.local",
                },
            )
            user.fullname = fullname
            user.role = "student"
            user.is_active = True
            user.student_id = f"IT10226-{index:03d}"
            user.group_code = "IT102-26"
            user.phone_number = f"+998 90 700 {index:02d} {index:02d}"
            if username == "talaba_demo":
                user.set_password(self.DEMO_PASSWORDS["talaba_demo"])
            elif created:
                user.set_unusable_password()
            user.save()
            students.append(user)

        Course.objects.filter(code='DEMO-101').update(is_archived=True)

        course_specs = [
            ("WD101", "Web dasturlash", "Frontend va backend web dasturlash"),
            ("DB201", "Ma’lumotlar bazasi", "SQL va ma’lumotlar bazasi asoslari"),
            ("PY101", "Python asoslari", "Python dasturlash asoslari"),
            ("NET201", "Tarmoq texnologiyalari", "Kompyuter tarmoqlari"),
            ("MOB201", "Mobil ilovalar", "Mobil dasturlash"),
            ("WEB201", "Web texnologiyalari", "Zamonaviy web texnologiyalar"),
            ("AI301", "Sun’iy intellekt", "AI va mashinaviy o‘rganish asoslari"),
            ("SYS201", "Tizimlar tahlili", "Axborot tizimlarini tahlil qilish"),
        ]
        courses = {}
        for code, title, description in course_specs:
            course, _ = Course.objects.update_or_create(
                code=code,
                defaults={
                    "title": title,
                    "description": description,
                    "teacher": teacher,
                    "is_archived": False,
                },
            )
            course.students.set(students)
            courses[code] = course

        tz = timezone.get_current_timezone()
        today = timezone.localdate()
        days_until_monday = (7 - today.weekday()) % 7
        monday = today + timedelta(days=days_until_monday)

        period_starts = {
            1: time(8, 0),
            2: time(9, 20),
            3: time(10, 40),
            4: time(12, 0),
            5: time(13, 20),
            6: time(14, 40),
        }
        CalendarEvent.objects.filter(
            created_by=teacher,
            event_type="lesson",
            description="IT102-26 kunduzgi guruh darsi",
        ).delete()

        schedule = [
            (0, 1, "Web dasturlash", "WD101", "A-301"),
            (0, 3, "Ma’lumotlar bazasi", "DB201", "B-204"),
            (1, 2, "Python asoslari", "PY101", "A-302"),
            (1, 4, "Tarmoq texnologiyalari", "NET201", "B-205"),
            (1, 5, "Web dasturlash", "WD101", "A-301"),
            (3, 1, "Mobil ilovalar", "MOB201", "B-201"),
            (3, 3, "Web texnologiyalari", "WEB201", "A-301"),
            (3, 4, "Sun’iy intellekt", "AI301", "A-401"),
            (3, 6, "Python asoslari", "PY101", "A-302"),
            (4, 2, "Ma’lumotlar bazasi", "DB201", "B-204"),
            (4, 4, "Web dasturlash", "WD101", "A-301"),
            (4, 5, "Tizimlar tahlili", "SYS201", "B-203"),
            (5, 1, "Python asoslari", "PY101", "A-302"),
            (5, 6, "Ma’lumotlar bazasi", "DB201", "B-204"),
        ]
        for day_offset, period, title, course_code, room in schedule:
            lesson_date = monday + timedelta(days=day_offset)
            start = timezone.make_aware(
                datetime.combine(lesson_date, period_starts[period]), tz
            )
            end = start + timedelta(minutes=70)
            CalendarEvent.objects.update_or_create(
                created_by=teacher,
                title=title,
                start_time=start,
                defaults={
                    "course": courses[course_code],
                    "description": "IT102-26 kunduzgi guruh darsi",
                    "event_type": "lesson",
                    "end_time": end,
                    "room": room,
                    "period": period,
                    "for_group": "IT102-26",
                },
            )

        now = timezone.now()
        active_start = now - timedelta(minutes=1)
        active_event, _ = CalendarEvent.objects.update_or_create(
            created_by=teacher,
            title="Joriy sinov darsi",
            defaults={
                "course": courses["WD101"],
                "description": "Hozirgi attendance oqimini tekshirish uchun faol dars",
                "event_type": "lesson",
                "start_time": active_start,
                "end_time": active_start + timedelta(minutes=70),
                "room": "A-301",
                "period": 6,
                "for_group": "IT102-26",
            },
        )

        web_course = courses["WD101"]
        active_session, _ = AttendanceSession.objects.update_or_create(
            calendar_event=active_event,
            defaults={
                "course": web_course,
                "starts_at": active_start,
                "topic": active_event.title,
                "automated_checkin": True,
                "attendance_minutes": 10,
                "late_after_minutes": 3,
                "location_latitude": None,
                "location_longitude": None,
                "location_radius_m": 80,
                "max_location_accuracy_m": 100,
                "ended_at": None,
            },
        )
        active_session.records.all().delete()
        for index, student in enumerate(students[1:19], start=1):
            AttendanceRecord.objects.create(
                session=active_session,
                student=student,
                status="late" if index in {7, 14} else "present",
                source="ultrasound" if index % 3 == 0 else "qr",
                checked_at=active_start + timedelta(seconds=15 * index),
                last_seen_at=active_start + timedelta(seconds=15 * index),
                presence_samples=1,
                note="",
            )

        web_course = courses["WD101"]
        book_specs = [
            ("HTML va CSS asoslari", "Web dasturlash", "HTML/CSS konspekti"),
            ("JavaScript asoslari", "Web dasturlash", "JavaScript konspekti"),
            ("React kirish", "Web dasturlash", "React bo‘yicha qo‘llanma"),
        ]
        for title, subject, body in book_specs:
            book = Book.objects.filter(course=web_course, title=title).first()
            if not book:
                book = Book(
                    course=web_course,
                    title=title,
                    subject=subject,
                    uploaded_by=teacher,
                )
                book.file.save(
                    f"{title.lower().replace(' ', '_')}.txt",
                    ContentFile(body.encode("utf-8")),
                    save=True,
                )

        assignment_specs = [
            ("HTML sahifa", 4, 88, "Tuzilishi yaxshi."),
            ("JavaScript DOM", 8, 94, "Yaxshi bajarilgan."),
            ("React komponentlari", 14, None, ""),
        ]
        demo_student = students[0]
        for index, (title, days, grade, feedback) in enumerate(
            assignment_specs, start=1
        ):
            assignment, _ = Assignment.objects.update_or_create(
                course=web_course,
                title=title,
                defaults={
                    "description": f"{title} bo‘yicha amaliy topshiriq.",
                    "deadline": now + timedelta(days=days),
                    "teacher": teacher,
                    "max_attempts": 3,
                    "allow_late": False,
                },
            )
            if grade is not None:
                submission = Submission.objects.filter(
                    assignment=assignment,
                    student=demo_student,
                    attempt=1,
                ).first()
                if not submission:
                    submission = Submission(
                        assignment=assignment,
                        student=demo_student,
                        attempt=1,
                        grade=grade,
                        feedback=feedback,
                    )
                    submission.file.save(
                        f"demo_answer_{index}.txt",
                        ContentFile(f"{title} javobi".encode("utf-8")),
                        save=True,
                    )
                else:
                    submission.grade = grade
                    submission.feedback = feedback
                    submission.save(update_fields=["grade", "feedback"])

        past_statuses = ["present", "late", "present", "absent", "present"]
        for index, attendance_status in enumerate(past_statuses, start=1):
            start = now - timedelta(days=index * 2)
            session, _ = AttendanceSession.objects.get_or_create(
                course=web_course,
                starts_at=start,
                defaults={
                    "topic": f"Web dasturlash #{index}",
                    "automated_checkin": False,
                    "attendance_minutes": 4,
                    "late_after_minutes": 2,
                    "ended_at": start + timedelta(minutes=70),
                },
            )
            AttendanceRecord.objects.update_or_create(
                session=session,
                student=demo_student,
                defaults={
                    "status": attendance_status,
                    "source": "manual",
                    "checked_at": start + timedelta(minutes=2),
                    "last_seen_at": start + timedelta(minutes=2) if attendance_status in {"present", "late"} else None,
                    "presence_samples": 1 if attendance_status in {"present", "late"} else 0,
                    "note": "",
                },
            )

        Notification.objects.get_or_create(
            user=demo_student,
            type="assignment",
            title="Yangi topshiriq",
            message="React komponentlari topshirig‘i qo‘shildi.",
            link="/assignments",
        )
        Notification.objects.get_or_create(
            user=demo_student,
            type="grade",
            title="Baho qo‘yildi",
            message="JavaScript DOM topshirig‘i baholandi.",
            link="/grades",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo LMS tayyor: {len(students)} talaba, "
                f"{len(courses)} fan, {len(schedule)} haftalik dars."
            )
        )
