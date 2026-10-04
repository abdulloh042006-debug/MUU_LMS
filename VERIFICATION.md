# Verification — 2026-10-04

- Django 5.2.17 integration suite: 22 tests passed after the authentication, password-management, security/business-logic audit and Notification model foundation changes.
- Authentication tests cover registration privilege protection, invalid/inactive login, `HttpOnly` + `SameSite=Strict` refresh cookies, refresh-token rotation, blacklist-backed logout, authenticated password change with current-password validation, admin-only password reset UI access, and immediate JWT revocation after the stored password hash changes.
- `rest_framework_simplejwt.token_blacklist` is enabled; the test database applied its migrations. `makemigrations --check --dry-run`: no project model changes detected.
- `python manage.py check`: no issues.
- Next.js 15.5.27 TypeScript checking passed.
- Next.js 15.5.27 production build passed, including all 16 application routes. On Windows this was verified with pnpm's hoisted node layout because the default pnpm layout requires symlink privileges while creating Next.js standalone output.
- Security/business-logic coverage additionally verifies guessed-ID/IDOR isolation for submissions and grading, strict deadline blocking when late work is disabled, no Submission PUT/PATCH path, 10 MB Submission upload limits, active-file extension rejection, `.zip` acceptance, protected downloads with `nosniff`, and course-list query count staying constant as the number of courses grows.
- Existing HTTP integration coverage includes teacher/student login, course creation, enrollment, assignment creation, multipart file submission, grading, student grades, attendance create/save/read and rendered manage/my-courses/attendance/preview pages.
- No authentication token is stored in `localStorage`; access tokens are kept in browser memory and refresh tokens are server-issued HttpOnly cookies.

## Not verified

- Production Docker/PostgreSQL concurrency and reverse-proxy HTTPS behavior were not re-run in this local verification.
- Browser visual/mobile interaction QA was not completed; TypeScript, Django integration tests and production rendering/build checks passed.
- Cloud application hosting is not configured by this verification; source changes are versioned in the GitHub repository.
