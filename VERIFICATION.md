# Verification — 2026-10-03

- Django 5.2.17 integration suite: 16 tests passed after final behavior changes.
- Tests cover registration privilege protection, login/refresh, inactive accounts, profile, course boundaries, enrollment, private file access, submission history/limits/deadlines, grading, archive rules and atomic attendance updates/clearing.
- Migration 0004 applied locally; `makemigrations --check --dry-run`: no changes detected.
- Next.js 15.5.27 production build passed, including TypeScript checking and all 16 route builds.
- 16 real HTTP requests through the running Next.js proxy passed: teacher/student login, course creation, enrollment, assignment creation, multipart file submission, grading, student grades, attendance creation/save/read, and rendered manage/my-courses/attendance/preview pages. Temporary test users, records and file were removed afterward.
- Earlier baseline HTTP checks also verified registration and profile updates through the proxy.
- Source formatting: Prettier 3.6.2; `git diff --check` passed.

## Not verified

- Docker is unavailable here; Compose build/start and PostgreSQL concurrent submissions were not executed.
- Browser visual/mobile interaction QA was not completed: the available cloud browser blocked localhost. HTTP rendering and TypeScript checks are not browser interaction tests.
- No cloud deployment or new GitHub repository was created. The connected GitHub identity differs from the original repository owner; the original remote remains unchanged.
