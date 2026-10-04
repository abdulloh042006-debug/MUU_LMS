import tempfile
from datetime import timedelta
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
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

    def test_registration_cannot_escalate_privileges(self):
        r=self.client.post('/api/register/', {'username':'newstudent','fullname':'New Student','email':'new@example.com','password':'StrongPass!246','confirm_password':'StrongPass!246','role':'admin','is_staff':True,'is_superuser':True}, format='json')
        self.assertEqual(r.status_code,201,r.data)
        user=User.objects.get(username='newstudent')
        self.assertEqual(user.role,'student');self.assertFalse(user.is_staff);self.assertFalse(user.is_superuser)
        self.assertNotIn('password',r.data);self.assertNotIn('refresh',r.data)
        self.assertIn('lms-refresh',r.cookies);self.assertTrue(r.cookies['lms-refresh']['httponly'])
        self.assertEqual(r.cookies['lms-refresh']['samesite'],'Strict')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+r.data['access'])
        self.assertEqual(self.client.get('/api/user/profile/').data['email'],'new@example.com')

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
            self.assertEqual(r.status_code,201,r.data);self.assertIsNone(r.data['grade'])
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('answer.txt',b'answer')}).status_code,400)
        self.assertTrue(self.client.get('/api/assignments/').data[0]['is_submitted'])
        submission=Submission.objects.first()
        self.assertEqual(self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':95}).status_code,403)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':101}).status_code,400)
        self.assertEqual(self.client.post(f'/api/grades/{submission.pk}/set/',{'grade':95}).status_code,200)
        self.authenticate();r=self.client.get('/api/grades/my/')
        self.assertEqual(r.data[0]['assignment']['title'],'Python')
        self.assertEqual(float(r.data[0]['grade']),95)

    def test_calendar_null_group_and_file_access(self):
        now=timezone.now()
        CalendarEvent.objects.create(title='Lesson',start_time=now,end_time=now+timedelta(hours=1),created_by=self.teacher,for_group=None,course=self.course)
        self.authenticate();self.assertEqual(len(self.client.get('/api/calendar/').data),1)
        book=Book.objects.create(title='Book',subject='IT',uploaded_by=self.teacher,course=self.course,file=SimpleUploadedFile('book.txt',b'Book contents'))
        download=self.client.get(book.file.url);self.assertEqual(download.status_code,200);self.assertEqual(download['X-Content-Type-Options'],'nosniff');download.close()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(book.file.url).status_code,401)

    def test_password_confirmation_and_weak_password(self):
        for password,confirm in [('123','123'),('StrongPass!246','wrong')]:
            r=self.client.post('/api/register/',{'username':'invalid','fullname':'Student','password':password,'confirm_password':confirm},format='json')
            self.assertEqual(r.status_code,400)

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

    def test_automated_attendance_qr_ultrasound_location_and_finalize(self):
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

        self.authenticate(self.teacher)
        finalized=self.client.post(f'/api/attendance/{session_id}/finalize/',{},format='json')
        self.assertEqual(finalized.status_code,200,finalized.data)
        missing_record=AttendanceRecord.objects.get(session_id=session_id,student=missing)
        self.assertEqual(missing_record.status,'absent')
        self.assertEqual(missing_record.source,'system')

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
