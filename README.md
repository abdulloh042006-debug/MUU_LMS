# MU LMS — Millat Umidi concept

University-styled design branch. Open `/preview` to inspect the clearly labeled design demo without a user account. Actual login and protected routes continue to use the real Django API. See DESIGN.md for sources, scope and remaining commercial-readiness work.

Integrated version of https://github.com/Abdullo200604/LMS (original author attribution retained in Git history).

## What works

- Next.js frontend and Django REST backend share one origin using `/api/` proxy routes.
- Real student registration, password validation, JWT login and automatic access-token refresh.
- Real profile editing, learning materials, assignment detail and file submission (1–10 attempts, teacher-configurable), grades, attendance and calendar.
- Authenticated file downloads. Students cannot set their own grades or register themselves as administrators.
- Django admin manages users, teacher roles, assignments, learning materials, submissions/grades and calendar events.
- PostgreSQL and persistent uploaded-file volumes for Docker; SQLite for local development.
- No mock login, fake grades, fictional lessons or fabricated saved profile updates.

- Course ownership and student rosters: teachers manage their own courses; students only access enrolled courses.
- Teacher workspace `/manage`: course creation/archive, roster, material upload, assignment editing, grading with feedback, attendance and calendar.
- Student workspace: enrolled courses, submission history, teacher feedback and personal attendance.

Materials retain the original database model name `Book`. Courses are now separate real records. Fake video lessons, progress, discussion and offline login were removed. See FEATURES.md for role boundaries and upgrade notes.

## Docker: frontend + backend + database

Requires Docker with Compose.

1. Copy `.env.example` to `.env` and set strong random `SECRET_KEY` and `DB_PASSWORD` values.
2. Run `docker compose up --build -d`.
3. Open http://localhost:3000 and create your student account.
4. Create the administrator: `docker compose exec backend python manage.py createsuperuser`.
5. Open http://localhost:3000/admin/ and sign in with the administrator account. Assign trusted users the `ustoz` role. Teachers then use `/manage` to create courses and add registered students by username. The admin uses a separate session login.

The database and uploaded files survive container recreation. Do not run `docker compose down -v` unless you intend to delete stored data.

## Local development (without Docker)

Python 3.12+, Node 22+, pnpm 11.25.0.

Backend, from `backend/`:

```sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

Frontend, in another terminal from `frontend/`:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open http://localhost:3000. No API keys or remote tunnel are required. Local SQLite is created automatically. To use PostgreSQL instead, provide DB_HOST, DB_NAME, DB_USER, DB_PASSWORD and DB_PORT.

`BACKEND_URL` is a **server-side, build-time** frontend setting, defaulting to http://127.0.0.1:8000. Docker sets it to http://backend:8000. Rebuild the frontend when changing it. Never put secrets in NEXT_PUBLIC variables.

## Deployment

This is a Python + Node + PostgreSQL application; GitHub Pages alone cannot run its backend. Deploy Compose to a server that supports Docker, put HTTPS in front of port 3000, and set ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS to the real domain. DEBUG=0 and a private SECRET_KEY are required. Keep the database and backend off public ports. The HTTPS proxy must overwrite forwarded headers and prevent clients reaching the application directly.

No cloud deployment or new GitHub repository has been created by this delivery: the connected GitHub identity is not the source repository owner and hosting access has not been configured. Docker configuration is supplied but Docker itself was unavailable in the build environment, so that path has not been executed.

## Verification

```sh
# backend/
python manage.py test api
python manage.py check
# frontend/
pnpm exec tsc --noEmit
pnpm build
```

Integration tests cover registration privilege protection, login, token refresh, profile persistence, protected endpoints, teacher assignment creation, ISO timestamps, file submission/attempt limits, grading, calendar visibility and authenticated file access.

Before production rollout, validate the institution’s acceptance requirements, PostgreSQL concurrency, operational backups, account/password recovery and file malware scanning. File type/size limits, login throttling and course-based access are implemented. Hosting, Docker execution and browser interaction testing remain unverified here.

## Eski bazani yangilash

Avval baza va `media/` katalogidan zaxira nusxa oling, so‘ng `python manage.py migrate` bajaring. Eski fayl/topshiriqlar o‘chirilmaydi. Administrator ularni tegishli kursga biriktirmaguncha talabalar ko‘rmaydi; muallif ustoz va administrator ko‘ra oladi. Eski takrorlangan urinish raqamlari ma’lumotni saqlagan holda tartiblanadi. Ustoz akkauntlarini administrator tasdiqlaydi; ochiq ro‘yxatdan o‘tish faqat talaba uchun.
