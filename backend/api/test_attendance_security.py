from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase

from .attendance_security import manual_code, consume_attempts
from .models import User, Course, AttendanceSession, AttendanceRecord, AttendanceAttemptWindow
from .views import make_qr_proof


class AttendanceSecurityTests(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(username='security-teacher', role='ustoz')
        self.student = User.objects.create_user(username='security-student', role='student')
        self.course = Course.objects.create(title='Security', code='SEC', teacher=self.teacher)
        self.course.students.add(self.student)
        self.session = AttendanceSession.objects.create(course=self.course, topic='Test', starts_at=timezone.now(), automated_checkin=True, location_latitude=41, location_longitude=69)
        self.client.force_authenticate(self.student)

    def submit(self, **changes):
        data = dict(session=self.session.pk, channel='qr', proof=make_qr_proof(self.session.pk), latitude=41, longitude=69, accuracy=5)
        data.update(changes)
        return self.client.post('/api/attendance/check-in/', data, format='json')

    def assert_error(self, response, code, status=400):
        self.assertEqual(response.status_code, status, response.data)
        self.assertEqual(set(response.data), {'code', 'message'})
        self.assertEqual(response.data['code'], code)

    def test_double_submit_leaves_every_field_unchanged(self):
        self.assertEqual(self.submit().status_code, 201)
        before = AttendanceRecord.objects.values().get()
        self.assert_error(self.submit(), 'already_checked_in', 409)
        self.assertEqual(AttendanceRecord.objects.values().get(), before)

    def test_unique_constraint_rejects_second_insert(self):
        self.assertEqual(self.submit().status_code, 201)
        with self.assertRaises(IntegrityError), transaction.atomic():
            AttendanceRecord.objects.create(session=self.session, student=self.student, status='late')
        self.assertEqual(self.session.records.count(), 1)

    def test_invalid_code(self):
        self.assert_error(self.submit(proof='tampered'), 'code_invalid')

    def test_expired_qr(self):
        with patch('django.core.signing.time.time', return_value=timezone.now().timestamp()-20):
            proof = make_qr_proof(self.session.pk)
        self.assert_error(self.submit(proof=proof), 'code_expired')

    def test_session_not_active(self):
        self.session.ended_at = timezone.now()
        self.session.save()
        self.assert_error(self.submit(), 'session_not_active')

    def test_not_enrolled(self):
        self.course.students.remove(self.student)
        self.assert_error(self.submit(), 'not_enrolled', 403)

    def test_student_brute_force_limit(self):
        with patch('api.attendance_security.time.time', return_value=1000):
            for _ in range(10):
                self.assert_error(self.submit(proof='bad'), 'code_invalid')
            self.assert_error(self.submit(), 'rate_limited', 429)
        self.assertEqual(self.session.records.count(), 0)

    def test_session_limit_across_students(self):
        with patch('api.attendance_security.time.time', return_value=1000):
            AttendanceAttemptWindow.objects.create(key=f'session:{self.session.pk}', window=16, attempts=120)
            self.assert_error(self.submit(), 'rate_limited', 429)

    def test_limit_resets_next_minute(self):
        with patch('api.attendance_security.time.time', return_value=1000):
            for _ in range(10):
                self.assertTrue(consume_attempts(self.student.pk, self.session.pk))
            self.assertFalse(consume_attempts(self.student.pk, self.session.pk))
        with patch('api.attendance_security.time.time', return_value=1060):
            self.assertTrue(consume_attempts(self.student.pk, self.session.pk))

    def test_teacher_cannot_check_in(self):
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.submit().status_code, 403)

    def test_anonymous_cannot_check_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.submit().status_code, 401)

    def test_manual_code_success(self):
        with patch('api.attendance_security.time.time', return_value=1000):
            code = manual_code(self.session.pk)
            self.assertEqual(len(code), 8)
            self.assertFalse(set(code) & set('0O1I'))
            response = self.submit(channel='manual_code', proof=code)
        self.assertEqual(response.status_code, 201, response.data)

    def test_manual_code_expired(self):
        with patch('api.attendance_security.time.time', return_value=1007):
            self.assert_error(self.submit(channel='manual_code', proof=manual_code(self.session.pk, 200)), 'code_expired')

    def test_manual_code_wrong_session(self):
        self.assert_error(self.submit(channel='manual_code', proof=manual_code(self.session.pk+1)), 'code_invalid')

    def test_shared_qr_allows_two_enrolled_students(self):
        proof = make_qr_proof(self.session.pk)
        self.assertEqual(self.submit(proof=proof).status_code, 201)
        other = User.objects.create_user(username='second-student', role='student')
        self.course.students.add(other)
        self.client.force_authenticate(other)
        self.assertEqual(self.submit(proof=proof).status_code, 201)
        self.assertEqual(self.session.records.count(), 2)

    def test_failure_log_has_only_allowlisted_metadata(self):
        with self.assertLogs('api.attendance', level='INFO') as logs:
            self.submit(proof='SECRET-PROOF')
        message = logs.records[0].getMessage()
        self.assertEqual(message, 'attendance_failure reason=code_invalid browser=Other os=Other')

    def test_teacher_challenge_exposes_code(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.get(f'/api/attendance/{self.session.pk}/challenge/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['manual_code']), 8)

    def test_client_failure_report_logs_only_reason_browser_and_os(self):
        with self.assertLogs('api.attendance', level='INFO') as logs:
            response = self.client.post(
                '/api/attendance/check-in/',
                {'reason': 'camera_denied', 'browser': 'Chrome', 'os': 'Android'},
                format='json',
            )
        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(response.data, {'reported': True})
        self.assertEqual(
            logs.records[0].getMessage(),
            'attendance_failure reason=camera_denied browser=Chrome os=Android',
        )

    def test_client_failure_report_rejects_unapproved_reason(self):
        response = self.client.post(
            '/api/attendance/check-in/',
            {'reason': 'private-detail', 'browser': 'Chrome', 'os': 'Android'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
