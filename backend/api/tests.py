import tempfile
from datetime import timedelta
from django.test import override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from .models import User, Assignment, Submission, CalendarEvent, Book, Course, AttendanceSession, AttendanceRecord
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
        download=self.client.get(book.file.url);self.assertEqual(download.status_code,200);download.close()
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
        self.assignment.allow_late=True;self.assignment.save()
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,201)
        self.authenticate(self.teacher)
        self.assertEqual(self.client.post(url,{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,403)

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

    def test_archived_course_and_inactive_account(self):
        self.course.is_archived=True;self.course.save()
        self.authenticate()
        self.assertEqual(self.client.post(f'/api/assignments/{self.assignment.pk}/submit/',{'file':SimpleUploadedFile('a.txt',b'answer')}).status_code,400)
        self.client.force_authenticate(None)
        self.student.is_active=False;self.student.save()
        self.assertEqual(self.client.post('/api/login/',{'username':'student','password':'StrongPass!246'}).status_code,401)

    def test_upload_rejects_executable_and_calendar_invalid_times(self):
        self.authenticate()
        self.assertEqual(self.client.post(f'/api/assignments/{self.assignment.pk}/submit/',{'file':SimpleUploadedFile('bad.exe',b'executable')}).status_code,400)
        self.authenticate(self.teacher)
        now=timezone.now()
        r=self.client.post('/api/calendar/',{'course':self.course.pk,'title':'Invalid','start_time':now.isoformat(),'end_time':(now-timedelta(hours=1)).isoformat()})
        self.assertEqual(r.status_code,400)
