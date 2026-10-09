# MU LMS — Millat Umidi concept

## Demo login accounts

Run `python manage.py seed_demo_lms` in the backend demo environment to create linked demo data and these development-only accounts:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin_demo` | `AdminDemo!2026` |
| Teacher | `ustoz_demo` | `UstozDemo!2026` |
| Student | `talaba_demo` | `TalabaDemo!2026` |

These credentials are for local/demo environments only; change them before production use.


University-styled design branch. Open `/preview` to inspect the clearly labeled design demo without a user account. Actual login and protected routes continue to use the real Django API. See DESIGN.md for sources, scope and remaining commercial-readiness work.

Integrated version of https://github.com/Abdullo200604/LMS (original author attribution retained in Git history).

## What works

- Next.js frontend and Django REST backend share one origin using `/api/` proxy routes.
- Admin-provisioned student/teacher accounts, password validation, JWT login and automatic access-token refresh. Public registration is disabled. Access tokens stay in browser memory; rotating refresh tokens are kept only in `HttpOnly`, `SameSite=Strict` cookies and are blacklisted on logout/rotation.
- Signed-in users change their own password from Profile by confirming the current password. Login recovery accepts phone + student ID only for admin-provisioned accounts with a previously linked Telegram chat; the bot sends the username and a 15-minute temporary password, which must be replaced before normal LMS access resumes. Email verification is not implemented. Any password change invalidates JWTs issued under the old password.
- Real profile editing, learning materials, assignment detail and file submission (1–10 attempts, teacher-configurable), grades, attendance and calendar.
- Authenticated file downloads. Students cannot set their own grades or register themselves as administrators.
- Django admin manages users, teacher roles, assignments, learning materials, submissions/grades and calendar events.
- PostgreSQL and persistent uploaded-file volumes for Docker; SQLite for local development.
- No mock login, fake grades, fictional lessons or fabricated saved profile updates.

- Course ownership and student rosters: teachers manage their own courses; students only access enrolled courses.
- Teacher workspace `/manage`: course creation/archive, roster, material upload, assignment editing, grading with feedback, attendance and calendar.
- Student workspace: enrolled courses, submission history, teacher feedback and personal attendance.

Materials retain the original database model name `Book`. Courses are now separate real records. Fake video lessons, progress, discussion and offline login were removed. See FEATURES.md for role boundaries and upgrade notes, and SECURITY_AUDIT.md for the latest IDOR, deadline, upload, N+1 and XSS-sink audit results.

## Docker: frontend + backend + attendance worker + database

Requires Docker with Compose. The separate `attendance_worker` service closes scheduled sessions and sends stale-presence alerts; keep it running alongside the backend.

1. Copy `.env.example` to `.env` and set strong random `SECRET_KEY` and `DB_PASSWORD` values.
2. Run `docker compose up --build -d`.
3. Create the administrator: `docker compose exec backend python manage.py createsuperuser`.
4. Open http://localhost:3000/admin/ and sign in with the administrator account. Create student/teacher accounts there, including student ID, phone and Telegram chat ID when account recovery is required. Assign trusted users the `ustoz` role.
5. Teachers then use `/manage` to create courses and add admin-provisioned students by username. The admin uses a separate session login.

The database and uploaded files survive container recreation. The backend container readiness probe calls `/api/health/`, which verifies a live database query before reporting healthy. Do not run `docker compose down -v` unless you intend to delete stored data.

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

For automatic attendance closure and presence alerts, run `python manage.py attendance_worker --watch --interval 15` in a separate backend terminal.

Open http://localhost:3000. No API keys or remote tunnel are required. Local SQLite is created automatically. To use PostgreSQL instead, provide DB_HOST, DB_NAME, DB_USER, DB_PASSWORD and DB_PORT.

`BACKEND_URL` is a **server-side, build-time** frontend setting, defaulting to http://127.0.0.1:8000. Docker sets it to http://backend:8000. Rebuild the frontend when changing it. Never put secrets in NEXT_PUBLIC variables.

## Deployment

A Render production Blueprint is provided in `render.yaml`; follow `DEPLOY_RENDER.md` before applying it or entering secrets.

This is a Python + Node + PostgreSQL application; GitHub Pages alone cannot run its backend. Deploy Compose to a server that supports Docker, put HTTPS in front of port 3000, and set ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS to the real domain. DEBUG=0 and a private SECRET_KEY are required. With DEBUG=0 the refresh cookie is `Secure`, so production authentication requires HTTPS. Keep the database and backend off public ports. The HTTPS proxy must overwrite forwarded headers and prevent clients reaching the application directly.

The source repository is on GitHub, but application hosting is separate. Docker and Render Blueprint configuration are supplied; production still needs environment-specific verification. For a deployment where the backend directly receives trusted HTTPS proxy headers, enable `SECURE_SSL_REDIRECT` and HSTS only after HTTPS works. For the supplied Render topology, keep these backend values at `0` because TLS terminates at the public frontend and backend traffic stays on the private network.

## Verification

```sh
# backend/
python manage.py test api
python manage.py check
# frontend/
pnpm exec tsc --noEmit
pnpm build
```

Integration tests cover registration privilege protection, login, HttpOnly refresh-cookie rotation, logout blacklisting, profile persistence, protected endpoints, teacher assignment creation, ISO timestamps, file submission/attempt limits, grading, calendar visibility and authenticated file access.

Before production rollout, validate the institution’s acceptance requirements, PostgreSQL concurrency, operational backups, account/password recovery and file malware scanning. File type/size limits, login throttling and course-based access are implemented. Hosting and Docker execution remain unverified here; browser smoke covers role navigation and teacher deep links, with the full interaction walkthrough still pending.

## Eski bazani yangilash

Avval baza va `media/` katalogidan zaxira nusxa oling, so‘ng `python manage.py migrate` bajaring. Bu SimpleJWT token-blacklist jadvallarini ham yaratadi. Eski fayl/topshiriqlar o‘chirilmaydi. Administrator ularni tegishli kursga biriktirmaguncha talabalar ko‘rmaydi; muallif ustoz va administrator ko‘ra oladi. Eski takrorlangan urinish raqamlari ma’lumotni saqlagan holda tartiblanadi. Talaba va ustoz hisoblarini administrator yaratadi; ommaviy ro‘yxatdan o‘tish yopiq.
