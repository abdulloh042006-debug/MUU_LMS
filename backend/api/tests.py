import tempfile
from unittest.mock import patch
from datetime import timedelta
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from rest_framework.test import APITestCase
from .models import User, Assignment, Submission, CalendarEvent, Book, Course, AttendanceSession, AttendanceRecord, Notification
from django.core.cache import cache

class IntegrationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.temp.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.student = User.objects.create_user(username='student', password='StrongPass!246', fullname='Student')
        self.teacher = User.objects.create_user(username='teacher', password='StrongPass!246', fullname='Teacher', role='ustoz')
        self.course = Course.objects.create(title='Programming',code='IT-101',teacher=self.teacher)
        self.course.students.add(self.student)
        self.assignment = Assignment.objects.create(title='Python', description='Build a function', deadline=timezone.now()+timedelta(days=2), teacher=self.teacher, course=self.course)

    def authenticate(self, user=None):
        self.client.force_authenticate(user or self.student)

    def test_notification_model_defaults_and_ordering(self):
        first=Notification.objects.create(user=self.student,type='assignment',title='Birinchi',message='Yangi topshiriq',link='/assignments/1')
        second=Notification.objects.create(user=self.student,type='grade',title='Ikkinchi',message='Baho qo‘yildi',link='/grades')
        self.assertFalse(first.is_read)
        self.assertEqual(list(Notification.objects.filter(user=self.student).values_list('id',flat=True)),[second.pk,first.pk])
        self.assertEqual(str(second),'student: Ikkinchi')

    def test_public_registration_is_disabled(self):
        r=self.client.post('/api/register/', {'username':'newstudent','password':'StrongPass!246'}, format='json')
        self.assertEqual(r.status_code,404)
        self.assertFalse(User.objects.filter(username='newstudent').exists())

    def test_login_refresh_and_invalid_password(self):
        self.assertEqual(self.client.post('/api/login/',{'username':'student','password':'wrong'}).status_code,401)
        r=self.client.post('/api/login/',{'username':'student','password':'StrongPass!246'})
        self.assertEqual(r.status_code,200);self.assertIn('access',r.data);self.assertNotIn('refresh',r.data)
        self.assertIn('lms-refresh',r.cookies);old_refresh=r.cookies['lms-refresh'].value
        refreshed=self.client.post('/api/token/refresh/',{},format='json')
        self.assertEqual(refreshed.status_code,200,refreshed.data);self.assertIn('access',refreshed.data)
        self.assertIn('lms-refresh',refreshed.cookies);self.assertNotEqual(old_refresh,refreshed.cookies['lms-refresh'].value)
        logged_out=self.client.post('/api/logout/',{},format='json')
        self.assertEqual(logged_out.status_code,204)
        self.assertEqual(self.client.post('/api/token/refresh/',{},format='json').status_code,401)

    def test_change_password_requires_current_password_and_keeps_session(self):
        self.authenticate()
        url='/api/user/password/change/'
        r=self.client.post(url,{'current_password':'wrong','new_password':'NewStrongPass!579','confirm_password':'NewStrongPass!579'},format='json')
        self.assertEqual(r.status_code,400)
        r=self.client.post(url,{'current_password':'StrongPass!246','new_password':'NewStrongPass!579','confirm_password':'NewStrongPass!579'},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertIn('access',r.data);self.assertNotIn('refresh',r.data);self.assertIn('lms-refresh',r.cookies)
        self.student.refresh_from_db();self.assertTrue(self.student.check_password('NewStrongPass!579'))

    def test_password_hash_change_revokes_existing_jwt_session(self):
        login=self.client.post('/api/login/',{'username':'student','password':'StrongPass!246'},format='json')
        self.assertEqual(login.status_code,200,login.data)
        access=login.data['access']
        self.student.set_password('ChangedStrongPass!864');self.student.save(update_fields=['password'])
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+access)
        self.assertEqual(self.client.get('/api/user/profile/').status_code,401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/token/refresh/',{},format='json').status_code,401)

    def test_private_lists_and_profile_patch(self):
        self.assertEqual(self.client.get('/api/assignments/').status_code,401)
        self.authenticate()
        r=self.client.patch('/api/user/profile/update/v2/',{'fullname':'Updated','bio':'My bio','email':'updated@example.com'},format='json')
        self.assertEqual(r.status_code,200);self.student.refresh_from_db();self.assertEqual(self.student.bio,'My bio')
        for path in ['assignments','books','calendar','grades/my']:
            self.assertEqual(self.client.get('/api/'+path+'/').status_code,200)

    def test_assignment_creation_role_and_iso_dates(self):
        data={'course':self.course.pk,'title':'New','description':'Work','deadline':(timezone.now()+timedelta(days=1)).isoformat()}
        self.authenticate();self.assertEqual(self.client.post('/api/assignments/create/',data).status_code,403)
        self.authenticate(self.teacher);r=self.client.post('/api/assignments/create/',data)
        self.assertEqual(r.status_code,201,r.data)

    def test_submission_grade_and_attempt_limit(self):
        self.authenticate()
        url=f'/api/assignments/{self.assignment.pk}/submit/'
        for attempt in range(3):
            r=self.client.post(url,{'file':SimpleUploadedFile('answer.txt',b'answer'),'grade':'100'})
            self.assertEqual(r.status_code,201,r.data);self.assertIsNone(r.data['grade']);self.assertIsNone(r.data['graded_at'])
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('answer.txt',b'answer')}).status_code,400)
        self.assertTrue(self.client.get('/api/assignments/').data[0]['is_submitted'])
        submission=Submission.objects.first()
        self.assertEqual(self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':95}).status_code,403)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':101}).status_code,400)
        graded=self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':95})
        self.assertEqual(graded.status_code,200)
        self.assertIsNotNone(graded.data['graded_at'])
        submission.refresh_from_db()
        self.assertIsNotNone(submission.graded_at)
        self.authenticate();r=self.client.get('/api/grades/my/')
        self.assertEqual(r.data[0]['assignment']['title'],'Python')
        self.assertEqual(float(r.data[0]['grade']),95)
        self.assertEqual(r.data[0]['graded_at'],graded.data['graded_at'])

    def test_calendar_null_group_and_file_access(self):
        now=timezone.now()
        CalendarEvent.objects.create(title='Lesson',start_time=now,end_time=now+timedelta(hours=1),created_by=self.teacher,for_group=None,course=self.course)
        self.authenticate();self.assertEqual(len(self.client.get('/api/calendar/').data),1)
        book=Book.objects.create(title='Book',subject='IT',uploaded_by=self.teacher,course=self.course,file=SimpleUploadedFile('book.txt',b'Book contents'))
        download=self.client.get(book.file.url);self.assertEqual(download.status_code,200);self.assertEqual(download['X-Content-Type-Options'],'nosniff');download.close()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(book.file.url).status_code,401)

    @patch('api.views.send_telegram_message', return_value=True)
    def test_account_recovery_uses_admin_identity_and_forces_password_change(self, mock_send):
        self.student.student_id='ST-2026-001'
        self.student.phone_number='+998 90 123 45 67'
        self.student.telegram_chat_id='123456789'
        self.student.save(update_fields=['student_id','phone_number','telegram_chat_id'])

        r=self.client.post('/api/account/recover/',{'student_id':'ST-2026-001','phone_number':'901234567'},format='json')
        self.assertEqual(r.status_code,200,r.data)
        mock_send.assert_called_once()
        message=mock_send.call_args.args[1]
        self.assertIn('Login: student',message)
        temporary=message.split('Vaqtinchalik parol: ',1)[1].split('\n',1)[0]

        self.student.refresh_from_db()
        self.assertTrue(self.student.must_change_password)
        self.assertGreater(self.student.temporary_password_expires_at,timezone.now())
        self.assertTrue(self.student.check_password(temporary))

        login=self.client.post('/api/login/',{'username':'student','password':temporary},format='json')
        self.assertEqual(login.status_code,200,login.data)
        self.assertTrue(login.data['must_change_password'])
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+login.data['access'])
        self.assertEqual(self.client.get('/api/courses/').status_code,401)
        self.assertEqual(self.client.get('/api/user/profile/').status_code,200)
        changed=self.client.post('/api/user/password/change/',{
            'current_password':temporary,
            'new_password':'RecoveredStrong!579',
            'confirm_password':'RecoveredStrong!579',
        },format='json')
        self.assertEqual(changed.status_code,200,changed.data)
        self.student.refresh_from_db()
        self.assertFalse(self.student.must_change_password)
        self.assertIsNone(self.student.temporary_password_expires_at)

        mock_send.reset_mock()
        generic=self.client.post('/api/account/recover/',{'student_id':'NOPE','phone_number':'998901234567'},format='json')
        self.assertEqual(generic.status_code,200,generic.data)
        mock_send.assert_not_called()

    @override_settings(TELEGRAM_BOT_TOKEN='123456:TESTTOKEN')
    def test_telegram_mini_app_link_uses_signed_init_data(self):
        import hashlib
        import hmac
        import json
        import time
        import urllib.parse

        pairs = {
            'auth_date': str(int(time.time())),
            'query_id': 'AAEAAAE',
            'user': json.dumps({'id': 987654321, 'first_name': 'Student'}, separators=(',', ':')),
        }
        check_string = '\n'.join(f'{key}={pairs[key]}' for key in sorted(pairs))
        secret = hmac.new(b'WebAppData', b'123456:TESTTOKEN', hashlib.sha256).digest()
        pairs['hash'] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        init_data = urllib.parse.urlencode(pairs)

        self.authenticate()
        linked = self.client.post('/api/account/telegram/link/', {'init_data': init_data}, format='json')
        self.assertEqual(linked.status_code, 200, linked.data)
        self.assertTrue(linked.data['telegram_connected'])
        self.student.refresh_from_db()
        self.assertEqual(self.student.telegram_chat_id, '987654321')

        tampered = init_data.replace('987654321', '987654322')
        rejected = self.client.post('/api/account/telegram/link/', {'init_data': tampered}, format='json')
        self.assertEqual(rejected.status_code, 400, rejected.data)

    def test_admin_user_forms_and_superuser_role(self):
        admin=User.objects.create_superuser(username='owner',password='StrongPass!246',fullname='Owner')
        self.assertEqual(admin.role,'admin')
        self.client.force_login(admin)
        for path in ['/admin/api/user/add/',f'/admin/api/user/{self.student.pk}/change/',f'/admin/api/user/{self.student.pk}/password/']:
            self.assertEqual(self.client.get(path).status_code,200)
        self.client.logout();self.client.force_login(self.student)
        self.assertNotEqual(self.client.get(f'/admin/api/user/{admin.pk}/password/').status_code,200)

    def test_course_boundaries_for_list_detail_and_files(self):
        other_teacher=User.objects.create_user(username='otherteacher',password='StrongPass!246',fullname='Other',role='ustoz')
        other=Course.objects.create(title='Private',code='P',teacher=other_teacher)
        task=Assignment.objects.create(title='Hidden',description='Private',deadline=timezone.now(),teacher=other_teacher,course=other)
        book=Book.objects.create(title='Secret',subject='Private',uploaded_by=other_teacher,course=other,file=SimpleUploadedFile('secret.txt',b'Private'))
        for user in [self.student,self.teacher]:
            self.authenticate(user)
            self.assertEqual(self.client.get(f'/api/assignments/{task.pk}/').status_code,404)
            self.assertEqual(self.client.get(book.file.url).status_code,404)
            self.assertNotIn(other.pk,[c['id'] for c in self.client.get('/api/courses/').data])
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post('/api/assignments/',{'title':'Invalid','description':'Invalid','deadline':timezone.now().isoformat(),'course':other.pk}).status_code,400)

    def test_roster_add_remove_and_student_cannot_self_enroll(self):
        newcomer=User.objects.create_user(username='newcomer',password='StrongPass!246',fullname='Newcomer')
        url=f'/api/courses/{self.course.pk}/students/'
        self.authenticate(newcomer)
        self.assertEqual(self.client.post(url,{'username':'newcomer'}).status_code,403)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post(url,{'username':'newcomer'}).status_code,201)
        self.authenticate(newcomer)
        self.assertEqual(self.client.get(f'/api/assignments/{self.assignment.pk}/').status_code,200)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.delete(url+f'{newcomer.pk}/').status_code,204)
        self.authenticate(newcomer)
        self.assertEqual(self.client.get(f'/api/assignments/{self.assignment.pk}/').status_code,404)

    def test_late_submission_settings_and_teacher_cannot_submit(self):
        self.assignment.deadline=timezone.now()-timedelta(hours=1);self.assignment.save()
        url=f'/api/assignments/{self.assignment.pk}/submit/'
        self.authenticate()
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,400)
        self.assertEqual(self.client.put(url,{'file':SimpleUploadedFile('replace.txt',b'replace')}).status_code,405)
        self.assertEqual(self.client.patch(url,{'file':SimpleUploadedFile('replace.txt',b'replace')}).status_code,405)
        self.assignment.allow_late=True;self.assignment.save()
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,201)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,403)

    def test_idor_guessed_submission_and_grade_ids_are_scoped(self):
        classmate=User.objects.create_user(username='classmate2',password='StrongPass!246',fullname='Classmate Two')
        self.course.students.add(classmate)
        foreign=Submission.objects.create(assignment=self.assignment,student=classmate,file=SimpleUploadedFile('foreign.pdf',b'%PDF-1.4 foreign'),grade=88)
        self.authenticate()
        self.assertEqual(self.client.get(f'/api/assignments/{self.assignment.pk}/submissions/').data,[])
        self.assertEqual(self.client.get('/api/grades/my/').data,[])
        self.assertEqual(self.client.post(f'/api/grades/{foreign.pk}/set/',{'grade':100}).status_code,403)
        self.assertEqual(self.client.get(f'/api/submissions/{foreign.pk}/').status_code,404)
        other_teacher=User.objects.create_user(username='othergrader',password='StrongPass!246',fullname='Other Grader',role='ustoz')
        self.authenticate(other_teacher)
        self.assertEqual(self.client.post(f'/api/grades/{foreign.pk}/set/',{'grade':100}).status_code,404)

    def test_history_visibility_and_no_deleting_submitted_work(self):
        other=User.objects.create_user(username='classmate',password='StrongPass!246',fullname='Classmate')
        self.course.students.add(other)
        submission=Submission.objects.create(assignment=self.assignment,student=self.student,file=SimpleUploadedFile('work.txt',b'work'))
        self.authenticate(other)
        self.assertEqual(self.client.get(f'/api/assignments/{self.assignment.pk}/submissions/').data,[])
        self.assertEqual(self.client.get(submission.file.url).status_code,404)
        self.authenticate(self.teacher)
        self.assertEqual(len(self.client.get(f'/api/assignments/{self.assignment.pk}/submissions/').data),1)
        self.assertEqual(self.client.delete(f'/api/assignments/{self.assignment.pk}/').status_code,400)

    def test_attendance_save_and_student_sees_only_own_records(self):
        self.authenticate(self.teacher)
        r=self.client.post('/api/attendance/',{'course':self.course.pk,'topic':'Lesson','starts_at':timezone.now().isoformat()})
        self.assertEqual(r.status_code,201,r.data)
        url=f"/api/attendance/{r.data['id']}/"
        r=self.client.put(url,{'records':[{'student':self.student.pk,'status':'present','note':''}]},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.authenticate()
        self.assertEqual(self.client.get('/api/attendance/my/').data[0]['status'],'present')
        self.assertEqual(self.client.put(url,{'records':[]},format='json').status_code,403)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.put(url,{'records':[]},format='json').status_code,200)
        self.assertEqual(AttendanceRecord.objects.count(),0)

    def test_invalid_attendance_is_atomic(self):
        session=AttendanceSession.objects.create(course=self.course,topic='Lesson',starts_at=timezone.now())
        stranger=User.objects.create_user(username='stranger',password='StrongPass!246',fullname='Stranger')
        self.authenticate(self.teacher)
        r=self.client.put(f'/api/attendance/{session.pk}/',{'records':[{'student':self.student.pk,'status':'present'},{'student':stranger.pk,'status':'absent'}]},format='json')
        self.assertEqual(r.status_code,400);self.assertEqual(session.records.count(),0)

    def test_course_list_query_count_does_not_scale_with_course_count(self):
        self.authenticate()
        with CaptureQueriesContext(connection) as small_ctx:
            small=self.client.get('/api/courses/')
            self.assertEqual(small.status_code,200)
        small_count=len(small_ctx)
        for i in range(20):
            course=Course.objects.create(title=f'Course {i}',code=f'Q-{i}',teacher=self.teacher)
            course.students.add(self.student)
        with CaptureQueriesContext(connection) as large_ctx:
            large=self.client.get('/api/courses/')
            self.assertEqual(large.status_code,200)
            self.assertEqual(len(large.data),21)
        self.assertLessEqual(len(large_ctx),small_count+1)

    def test_archived_course_and_inactive_account(self):
        self.course.is_archived=True;self.course.save()
        self.authenticate()
        self.assertEqual(self.client.post(f'/api/assignments/{self.assignment.pk}/submit/',{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,400)
        self.client.force_authenticate(None)
        self.student.is_active=False;self.student.save()
        self.assertEqual(self.client.post('/api/login/',{'username':'student','password':'StrongPass!246'}).status_code,401)

    def test_submission_upload_allowlist_and_size_limit(self):
        self.authenticate()
        url=f'/api/assignments/{self.assignment.pk}/submit/'
        for name in ['bad.exe','bad.sh','bad.html','bad.svg','bad.js']:
            self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile(name,b'blocked')}).status_code,400)
        too_big=SimpleUploadedFile('too-big.pdf',b'x'*(10*1024*1024+1))
        self.assertEqual(self.client.post(url,{'file':too_big}).status_code,400)
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('answer.zip',b'PK\x03\x04safe')}).status_code,201)

    def test_upload_rejects_executable_and_calendar_invalid_times(self):
        self.authenticate()
        self.assertEqual(self.client.post(f'/api/assignments/{self.assignment.pk}/submit/',{'file':SimpleUploadedFile('bad.exe',b'executable')}).status_code,400)
        self.authenticate(self.teacher)
        now=timezone.now()
        r=self.client.post('/api/calendar/',{'course':self.course.pk,'title':'Invalid','start_time':now.isoformat(),'end_time':(now-timedelta(hours=1)).isoformat()})
        self.assertEqual(r.status_code,400)

    def test_notifications_are_private_and_can_be_marked_read(self):
        own=Notification.objects.create(user=self.student,type='system',title='Own')
        other=User.objects.create_user(username='notify-other',password='StrongPass!246',fullname='Other')
        foreign=Notification.objects.create(user=other,type='system',title='Foreign')
        self.assertEqual(self.client.get('/api/notifications/').status_code,401)
        self.authenticate()
        r=self.client.get('/api/notifications/')
        self.assertEqual(r.status_code,200);self.assertEqual([item['id'] for item in r.data],[own.pk])
        self.assertEqual(self.client.post(f'/api/notifications/{foreign.pk}/read/').status_code,404)
        marked=self.client.post(f'/api/notifications/{own.pk}/read/')
        self.assertEqual(marked.status_code,200);self.assertTrue(marked.data['is_read'])
        second=Notification.objects.create(user=self.student,type='system',title='Second')
        r=self.client.post('/api/notifications/read-all/')
        self.assertEqual(r.status_code,200);self.assertEqual(r.data['updated'],1)
        second.refresh_from_db();self.assertTrue(second.is_read)

    def test_notification_triggers_for_core_lms_actions(self):
        self.authenticate(self.teacher)
        r=self.client.post('/api/assignments/',{'course':self.course.pk,'title':'Notify task','description':'Do it','deadline':(timezone.now()+timedelta(days=1)).isoformat()},format='json')
        self.assertEqual(r.status_code,201,r.data)
        self.assertTrue(Notification.objects.filter(user=self.student,type='assignment',link=f"/assignments/{r.data['id']}").exists())
        self.authenticate()
        submission=self.client.post(f'/api/assignments/{self.assignment.pk}/submit/',{'file':SimpleUploadedFile('notify.txt',b'answer')})
        self.assertEqual(submission.status_code,201,submission.data)
        self.assertTrue(Notification.objects.filter(user=self.teacher,type='submission').exists())
        self.authenticate(self.teacher)
        graded=self.client.post(f"/api/grades/{submission.data['id']}/set/",{'grade':91,'feedback':'Good'},format='json')
        self.assertEqual(graded.status_code,200,graded.data)
        self.assertTrue(Notification.objects.filter(user=self.student,type='grade',link='/grades').exists())

    def test_assignment_list_query_count_does_not_scale(self):
        self.authenticate()
        with CaptureQueriesContext(connection) as small_ctx:
            small=self.client.get('/api/assignments/')
            self.assertEqual(small.status_code,200)
        small_count=len(small_ctx)
        for i in range(20):
            Assignment.objects.create(course=self.course,title=f'Task {i}',description='Work',deadline=timezone.now()+timedelta(days=1),teacher=self.teacher)
        with CaptureQueriesContext(connection) as large_ctx:
            large=self.client.get('/api/assignments/')
            self.assertEqual(large.status_code,200);self.assertEqual(len(large.data),21)
        self.assertLessEqual(len(large_ctx),small_count+1)

    def test_course_student_member_route_rejects_collection_methods(self):
        newcomer=User.objects.create_user(username='route-student',password='StrongPass!246',fullname='Route Student')
        self.course.students.add(newcomer)
        self.authenticate(self.teacher)
        member=f'/api/courses/{self.course.pk}/students/{newcomer.pk}/'
        self.assertEqual(self.client.get(member).status_code,405)
        self.assertEqual(self.client.post(member,{'username':'route-student'}).status_code,405)
        self.assertEqual(self.client.delete(member).status_code,204)

    def test_automated_attendance_qr_ultrasound_location_and_auto_close(self):
        classmate=User.objects.create_user(username='auto-classmate',password='StrongPass!246',fullname='Auto Classmate')
        missing=User.objects.create_user(username='auto-missing',password='StrongPass!246',fullname='Auto Missing')
        self.course.students.add(classmate,missing)
        latitude=41.311081
        longitude=69.240562

        self.authenticate(self.teacher)
        created=self.client.post('/api/attendance/',{
            'course':self.course.pk,
            'topic':'Secure attendance',
            'starts_at':timezone.now().isoformat(),
            'automated_checkin':True,
            'attendance_minutes':4,
            'late_after_minutes':1,
            'location_latitude':latitude,
            'location_longitude':longitude,
            'location_radius_m':100,
            'max_location_accuracy_m':50,
        },format='json')
        self.assertEqual(created.status_code,201,created.data)
        session_id=created.data['id']

        challenge=self.client.get(f'/api/attendance/{session_id}/challenge/')
        self.assertEqual(challenge.status_code,200,challenge.data)
        self.assertEqual(challenge.data['refresh_seconds'],5)
        self.assertTrue(challenge.data['qr_proof'])
        self.assertEqual(len(challenge.data['ultrasound_code']),8)

        self.authenticate()
        active=self.client.get('/api/attendance/active/')
        self.assertEqual(active.status_code,200,active.data)
        self.assertIn(session_id,[row['id'] for row in active.data])
        checked=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'qr',
            'proof':challenge.data['qr_proof'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':8,
        },format='json')
        self.assertEqual(checked.status_code,201,checked.data)
        self.assertEqual(checked.data['status'],'present')
        self.assertEqual(checked.data['source'],'qr')
        self.assertLessEqual(checked.data['distance_m'],1)

        replay=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'qr',
            'proof':challenge.data['qr_proof'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':8,
        },format='json')
        self.assertEqual(replay.status_code,200,replay.data)
        self.assertTrue(replay.data['already_checked_in'])
        self.assertEqual(AttendanceRecord.objects.filter(session_id=session_id,student=self.student).count(),1)

        self.authenticate(classmate)
        outside=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'qr',
            'proof':challenge.data['qr_proof'],
            'latitude':latitude+0.02,
            'longitude':longitude,
            'accuracy':10,
        },format='json')
        self.assertEqual(outside.status_code,400,outside.data)

        session=AttendanceSession.objects.get(pk=session_id)
        session.starts_at=timezone.now()-timedelta(minutes=2)
        session.save(update_fields=['starts_at'])
        self.authenticate(self.teacher)
        ultrasound=self.client.get(f'/api/attendance/{session_id}/challenge/')
        self.assertEqual(ultrasound.status_code,200,ultrasound.data)

        self.authenticate(classmate)
        checked=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'ultrasound',
            'proof':ultrasound.data['ultrasound_code'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':10,
        },format='json')
        self.assertEqual(checked.status_code,201,checked.data)
        self.assertEqual(checked.data['status'],'late')
        self.assertEqual(checked.data['source'],'ultrasound')

        session.starts_at=timezone.now()-timedelta(minutes=5)
        session.save(update_fields=['starts_at'])
        self.authenticate(self.teacher)
        synced=self.client.get(f'/api/attendance/{session_id}/')
        self.assertEqual(synced.status_code,200,synced.data)
        missing_record=AttendanceRecord.objects.get(session_id=session_id,student=missing)
        self.assertEqual(missing_record.status,'absent')
        self.assertEqual(missing_record.source,'system')
        session.refresh_from_db()
        self.assertIsNone(session.ended_at)

        session.starts_at=timezone.now()-timedelta(minutes=71)
        session.save(update_fields=['starts_at'])
        self.client.get(f'/api/attendance/{session_id}/')
        session.refresh_from_db()
        self.assertIsNotNone(session.ended_at)

        self.authenticate()
        after_end=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'ultrasound',
            'proof':ultrasound.data['ultrasound_code'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':10,
        },format='json')
        self.assertEqual(after_end.status_code,400,after_end.data)

    def test_presence_heartbeat_updates_last_seen_and_stale_state(self):
        latitude=41.311081
        longitude=69.240562
        self.authenticate(self.teacher)
        created=self.client.post('/api/attendance/',{
            'course':self.course.pk,
            'topic':'Presence heartbeat',
            'starts_at':timezone.now().isoformat(),
            'automated_checkin':True,
            'attendance_minutes':4,
            'late_after_minutes':1,
            'location_latitude':latitude,
            'location_longitude':longitude,
            'location_radius_m':100,
            'max_location_accuracy_m':50,
        },format='json')
        self.assertEqual(created.status_code,201,created.data)
        session_id=created.data['id']

        first_challenge=self.client.get(f'/api/attendance/{session_id}/challenge/')
        self.authenticate()
        checked=self.client.post('/api/attendance/check-in/',{
            'session':session_id,
            'channel':'qr',
            'proof':first_challenge.data['qr_proof'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':8,
        },format='json')
        self.assertEqual(checked.status_code,201,checked.data)
        self.assertEqual(checked.data['presence_samples'],1)
        self.assertEqual(checked.data['presence_state'],'confirmed')
        AttendanceRecord.objects.filter(session_id=session_id, student=self.student).update(
            presence_alerted_at=timezone.now()
        )

        self.authenticate(self.teacher)
        heartbeat_challenge=self.client.get(f'/api/attendance/{session_id}/challenge/')
        self.assertEqual(heartbeat_challenge.status_code,200,heartbeat_challenge.data)
        self.authenticate()
        heartbeat=self.client.post('/api/attendance/presence/',{
            'session':session_id,
            'proof':heartbeat_challenge.data['ultrasound_code'],
            'latitude':latitude,
            'longitude':longitude,
            'accuracy':9,
        },format='json')
        self.assertEqual(heartbeat.status_code,200,heartbeat.data)
        self.assertTrue(heartbeat.data['presence_confirmed'])
        self.assertEqual(heartbeat.data['presence_samples'],2)
        self.assertEqual(heartbeat.data['presence_state'],'confirmed')

        record=AttendanceRecord.objects.get(session_id=session_id,student=self.student)
        self.assertIsNone(record.presence_alerted_at)
        record.last_seen_at=timezone.now()-timedelta(minutes=6)
        record.save(update_fields=['last_seen_at'])

        self.authenticate(self.teacher)
        detail=self.client.get(f'/api/attendance/{session_id}/')
        self.assertEqual(detail.status_code,200,detail.data)
        student_row=next(row for row in detail.data if row['student']==self.student.pk)
        self.assertEqual(student_row['presence_state'],'stale')

    def test_attendance_worker_alerts_stale_presence_once(self):
        now = timezone.now()
        session = AttendanceSession.objects.create(
            course=self.course, topic='Signal monitoring',
            starts_at=now - timedelta(minutes=8), automated_checkin=True,
            attendance_minutes=3, late_after_minutes=1,
        )
        record = AttendanceRecord.objects.create(
            session=session, student=self.student, status='present',
            source='ultrasound', checked_at=now - timedelta(minutes=8),
            last_seen_at=now - timedelta(minutes=6), presence_samples=2,
        )
        call_command('attendance_worker')
        record.refresh_from_db()
        self.assertIsNotNone(record.presence_alerted_at)
        self.assertEqual(Notification.objects.filter(user=self.teacher, type='attendance').count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.student, type='attendance').count(), 1)
        call_command('attendance_worker')
        self.assertEqual(Notification.objects.filter(type='attendance').count(), 2)

    def test_lesson_schedule_starts_reuses_and_auto_ends_attendance(self):
        now=timezone.now()
        event=CalendarEvent.objects.create(
            course=self.course,
            title='Web dasturlash',
            description='IT102-26',
            event_type='lesson',
            start_time=now-timedelta(minutes=1),
            end_time=now+timedelta(minutes=69),
            room='A-301',
            period=1,
            for_group='IT102-26',
            created_by=self.teacher,
        )
        self.authenticate(self.teacher)
        started=self.client.post(
            f'/api/lessons/{event.pk}/attendance/',
            {'latitude':41.311081,'longitude':69.240562},
            format='json',
        )
        self.assertEqual(started.status_code,201,started.data)
        session_id=started.data['session']['id']
        self.assertEqual(started.data['session']['calendar_event'],event.pk)
        self.assertEqual(started.data['event']['room'],'A-301')
        self.assertEqual(started.data['event']['period'],1)

        again=self.client.post(
            f'/api/lessons/{event.pk}/attendance/',
            {'latitude':41.311081,'longitude':69.240562},
            format='json',
        )
        self.assertEqual(again.status_code,200,again.data)
        self.assertEqual(again.data['session']['id'],session_id)

        self.authenticate()
        active=self.client.get('/api/attendance/active/')
        self.assertEqual(active.status_code,200,active.data)
        self.assertIn(session_id,[row['id'] for row in active.data])

        session=AttendanceSession.objects.get(pk=session_id)
        event.end_time=timezone.now()-timedelta(seconds=1)
        event.save(update_fields=['end_time'])
        self.authenticate(self.teacher)
        state=self.client.get(f'/api/lessons/{event.pk}/attendance/')
        self.assertEqual(state.status_code,200,state.data)
        session.refresh_from_db()
        self.assertIsNotNone(session.ended_at)

    def test_attendance_group_scope_supports_seminar_and_multi_group_lecture(self):
        self.student.group_code='IT102-26'
        self.student.save(update_fields=['group_code'])
        second=User.objects.create_user(
            username='group-b-student',
            password='StrongPass!246',
            fullname='Group B Student',
            group_code='IT103-26',
        )
        outsider=User.objects.create_user(
            username='group-c-student',
            password='StrongPass!246',
            fullname='Group C Student',
            group_code='IT104-26',
        )
        self.course.students.add(second,outsider)
        now=timezone.now()

        seminar=CalendarEvent.objects.create(
            course=self.course,
            title='Seminar',
            description='One group',
            event_type='lesson',
            start_time=now-timedelta(minutes=1),
            end_time=now+timedelta(minutes=69),
            room='A-301',
            period=1,
            for_group='IT102-26',
            created_by=self.teacher,
        )
        self.authenticate(self.teacher)
        started=self.client.post(
            f'/api/lessons/{seminar.pk}/attendance/',
            {'latitude':41.311081,'longitude':69.240562},
            format='json',
        )
        self.assertEqual(started.status_code,201,started.data)
        seminar_session=started.data['session']['id']
        self.assertEqual(started.data['session']['student_count'],1)
        seminar_roster=self.client.get(f'/api/attendance/{seminar_session}/roster/')
        self.assertEqual(seminar_roster.status_code,200,seminar_roster.data)
        self.assertEqual([row['id'] for row in seminar_roster.data],[self.student.pk])

        self.authenticate(second)
        active=self.client.get('/api/attendance/active/')
        self.assertNotIn(seminar_session,[row['id'] for row in active.data])
        blocked=self.client.post('/api/attendance/check-in/',{
            'session':seminar_session,
            'channel':'qr',
            'proof':'not-used-because-group-check-runs-first',
            'latitude':41.311081,
            'longitude':69.240562,
            'accuracy':8,
        },format='json')
        self.assertEqual(blocked.status_code,403,blocked.data)

        lecture_course=Course.objects.create(
            title='Lecture course',
            code='LECT-101',
            teacher=self.teacher,
        )
        lecture_course.students.add(self.student,second,outsider)
        lecture=CalendarEvent.objects.create(
            course=lecture_course,
            title='Lecture',
            description='Two groups',
            event_type='lesson',
            start_time=now-timedelta(minutes=1),
            end_time=now+timedelta(minutes=69),
            room='Hall-1',
            period=2,
            for_group='IT102-26, IT103-26',
            created_by=self.teacher,
        )
        self.authenticate(self.teacher)
        lecture_started=self.client.post(
            f'/api/lessons/{lecture.pk}/attendance/',
            {'latitude':41.311081,'longitude':69.240562},
            format='json',
        )
        self.assertEqual(lecture_started.status_code,201,lecture_started.data)
        lecture_session=lecture_started.data['session']['id']
        self.assertEqual(lecture_started.data['session']['student_count'],2)
        lecture_roster=self.client.get(f'/api/attendance/{lecture_session}/roster/')
        self.assertEqual(
            {row['id'] for row in lecture_roster.data},
            {self.student.pk,second.pk},
        )

        self.authenticate(second)
        active=self.client.get('/api/attendance/active/')
        self.assertIn(lecture_session,[row['id'] for row in active.data])

    def test_manual_attendance_marks_one_student_without_overwriting_other_sources(self):
        classmate=User.objects.create_user(username='manual-classmate',password='StrongPass!246',fullname='Manual Classmate')
        self.course.students.add(classmate)
        session=AttendanceSession.objects.create(
            course=self.course,
            starts_at=timezone.now(),
            topic='Manual roster correction',
            automated_checkin=False,
        )
        existing=AttendanceRecord.objects.create(
            session=session,
            student=self.student,
            status='present',
            source='qr',
            checked_at=timezone.now(),
        )

        self.authenticate(self.teacher)
        marked=self.client.post(
            f'/api/attendance/{session.pk}/manual/',
            {'student':classmate.pk,'status':'excused','note':'Telefon ishlamadi'},
            format='json',
        )
        self.assertEqual(marked.status_code,200,marked.data)
        self.assertEqual(marked.data['student'],classmate.pk)
        self.assertEqual(marked.data['status'],'excused')
        self.assertEqual(marked.data['source'],'manual')

        existing.refresh_from_db()
        self.assertEqual(existing.status,'present')
        self.assertEqual(existing.source,'qr')
        manual=AttendanceRecord.objects.get(session=session,student=classmate)
        self.assertEqual(manual.note,'Telefon ishlamadi')
        self.assertEqual(AttendanceRecord.objects.filter(session=session).count(),2)

    def test_upload_download_format_matrix_and_deadline(self):
        self.authenticate(self.teacher)
        downloads=[]
        for name in ['guide.pdf','guide.docx','slides.pptx','sheet.xlsx','notes.txt','bundle.zip','photo.jpg']:
            uploaded=self.client.post('/api/books/',{
                'course':self.course.pk,
                'title':name,
                'subject':'Files',
                'file':SimpleUploadedFile(name,b'safe test content'),
            })
            self.assertEqual(uploaded.status_code,201,(name,uploaded.data))
            downloads.append(uploaded.data['file'])

        blocked=self.client.post('/api/books/',{
            'course':self.course.pk,
            'title':'Blocked',
            'subject':'Files',
            'file':SimpleUploadedFile('active.html',b'<script>alert(1)</script>'),
        })
        self.assertEqual(blocked.status_code,400,blocked.data)
        oversized=self.client.post('/api/books/',{
            'course':self.course.pk,
            'title':'Too big',
            'subject':'Files',
            'file':SimpleUploadedFile('too-big.pdf',b'x'*(20*1024*1024+1)),
        })
        self.assertEqual(oversized.status_code,400,oversized.data)

        attached=self.client.post('/api/assignments/',{
            'course':self.course.pk,
            'title':'Attachment test',
            'description':'Download and submit',
            'deadline':(timezone.now()+timedelta(hours=1)).isoformat(),
            'file':SimpleUploadedFile('starter.zip',b'PK\x03\x04starter'),
        })
        self.assertEqual(attached.status_code,201,attached.data)
        assignment_id=attached.data['id']
        assignment_file=attached.data['file']

        self.authenticate()
        for path in downloads+[assignment_file]:
            response=self.client.get(path)
            self.assertEqual(response.status_code,200,path)
            self.assertEqual(response['X-Content-Type-Options'],'nosniff')
            self.assertIn('attachment',response['Content-Disposition'])
            response.close()

        submitted=self.client.post(
            f'/api/assignments/{assignment_id}/submit/',
            {'file':SimpleUploadedFile('answer.docx',b'docx content')},
        )
        self.assertEqual(submitted.status_code,201,submitted.data)
        student_download=self.client.get(submitted.data['file'])
        self.assertEqual(student_download.status_code,200,submitted.data['file'])
        self.assertIn('attachment',student_download['Content-Disposition'])
        student_download.close()

        self.authenticate(self.teacher)
        teacher_download=self.client.get(submitted.data['file'])
        self.assertEqual(teacher_download.status_code,200,submitted.data['file'])
        self.assertIn('attachment',teacher_download['Content-Disposition'])
        teacher_download.close()

        self.authenticate()
        task=Assignment.objects.get(pk=assignment_id)
        task.deadline=timezone.now()-timedelta(seconds=1)
        task.allow_late=False
        task.save(update_fields=['deadline','allow_late'])
        late=self.client.post(
            f'/api/assignments/{assignment_id}/submit/',
            {'file':SimpleUploadedFile('late.pdf',b'%PDF-1.4 late')},
        )
        self.assertEqual(late.status_code,400,late.data)


    def test_admin_api_is_private_and_manages_accounts(self):
        self.authenticate()
        self.assertEqual(self.client.get('/api/admin/users/').status_code, 403)
        self.assertEqual(self.client.get('/api/admin/stats/').status_code, 403)

        owner = User.objects.create_superuser(
            username='api-owner',
            password='OwnerPass!246',
            fullname='API Owner',
        )
        self.authenticate(owner)

        listing = self.client.get('/api/admin/users/')
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertNotIn(owner.pk, [row['id'] for row in listing.data])

        created = self.client.post('/api/admin/users/', {
            'fullname': 'New Student',
            'username': 'new-admin-created-student',
            'role': 'student',
            'student_id': 'ADM-001',
            'phone_number': '+998901112233',
            'telegram_chat_id': '998001122',
            'email': 'student@example.com',
            'password': 'StartPass!579',
            'is_active': True,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)

        managed = User.objects.get(username='new-admin-created-student')
        self.assertTrue(managed.must_change_password)
        self.assertTrue(managed.check_password('StartPass!579'))
        self.assertEqual(managed.telegram_chat_id, '998001122')

        updated = self.client.patch(
            f'/api/admin/users/{managed.pk}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        managed.refresh_from_db()
        self.assertFalse(managed.is_active)

        stats = self.client.get('/api/admin/stats/')
        self.assertEqual(stats.status_code, 200, stats.data)
        self.assertIn('students_active', stats.data)
        self.assertIn('submissions_pending', stats.data)


    def test_admin_course_creation_requires_teacher_assignment(self):
        owner = User.objects.create_superuser(
            username='course-owner',
            password='OwnerPass!246',
            fullname='Course Owner',
        )
        self.authenticate(owner)

        missing_teacher = self.client.post(
            '/api/courses/',
            {'title': 'Missing teacher', 'code': 'ADM-NO-TEACHER'},
            format='json',
        )
        self.assertEqual(missing_teacher.status_code, 400, missing_teacher.data)

        created = self.client.post(
            '/api/courses/',
            {
                'title': 'Admin managed course',
                'code': 'ADM-COURSE',
                'teacher': self.teacher.pk,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['teacher'], self.teacher.pk)
