import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import close_old_connections, transaction
from django.utils import timezone

from api.models import AttendanceRecord, AttendanceSession
from api.views import lesson_ends_at, notify_user, sync_attendance_session


class Command(BaseCommand):
    help = "Sync automated attendance windows and close lessons when their scheduled time ends."

    def add_arguments(self, parser):
        parser.add_argument(
            "--watch",
            action="store_true",
            help="Keep running and sync periodically.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=15,
            help="Seconds between sync cycles in watch mode (default: 15).",
        )

    def sync_once(self):
        now = timezone.now()
        sessions = list(
            AttendanceSession.objects.filter(ended_at__isnull=True)
            .select_related("course", "calendar_event")
        )
        closed = 0
        absent_added = 0
        stale_alerts = 0
        for session in sessions:
            before_count = session.records.count()
            was_open = session.ended_at is None
            sync_attendance_session(session, now)
            session.refresh_from_db(fields=["ended_at"])
            after_count = session.records.count()
            absent_added += max(after_count - before_count, 0)
            if was_open and session.ended_at is not None:
                closed += 1
            if session.ended_at or now >= lesson_ends_at(session):
                continue
            stale_records = AttendanceRecord.objects.filter(
                session=session,
                status__in=['present', 'late'],
                source__in=['qr', 'ultrasound'],
                last_seen_at__lt=now - timedelta(minutes=5),
                presence_alerted_at__isnull=True,
            ).select_related('student')
            for record in stale_records:
                with transaction.atomic():
                    claimed = AttendanceRecord.objects.filter(
                        pk=record.pk, presence_alerted_at__isnull=True,
                        last_seen_at__lt=now - timedelta(minutes=5),
                    ).update(presence_alerted_at=now)
                    if not claimed:
                        continue
                    link = f'/lessons/{session.calendar_event_id}' if session.calendar_event_id else '/attendance'
                    notify_user(
                        session.course.teacher, 'attendance', 'Davomat signali uzildi',
                        f'{record.student.fullname}: {session.topic} darsida 5 daqiqadan beri tasdiq yo‘q.', link,
                    )
                    notify_user(
                        record.student, 'attendance', 'Davomatingizni tasdiqlang',
                        f'{session.topic} darsida qatnashishni qayta tasdiqlang.', '/attendance',
                    )
                    stale_alerts += 1
        return len(sessions), closed, absent_added, stale_alerts

    def handle(self, *args, **options):
        interval = max(5, min(int(options["interval"]), 300))
        watch = bool(options["watch"])

        while True:
            close_old_connections()
            checked, closed, absent_added, stale_alerts = self.sync_once()
            self.stdout.write(
                f"{timezone.localtime().strftime('%Y-%m-%d %H:%M:%S')} "
                f"checked={checked} closed={closed} absent_added={absent_added} "
                f"stale_alerts={stale_alerts}"
            )
            if not watch:
                return
            time.sleep(interval)
