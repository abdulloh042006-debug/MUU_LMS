# Render HTTPS deployment

`render.yaml` defines the production baseline:

- public Next.js frontend with automatic HTTPS;
- private Django backend;
- managed PostgreSQL;
- background attendance worker;
- persistent `/app/media` disk.

## Before applying

1. Open Render and create a Blueprint from this GitHub repository and branch.
2. Review the shown monthly price before pressing **Apply**. The committed plans are paid production baselines; no resource is created merely by committing this file.
3. Set `CSRF_TRUSTED_ORIGINS` to the exact public frontend origin, for example `https://mu-lms.onrender.com`. Do not add a trailing slash.
4. Set `TELEGRAM_BOT_TOKEN` only when the production bot is ready. Keep it secret.
5. Keep the generated `SECRET_KEY` unchanged after accounts and tokens exist.

## First deployment

The backend container automatically runs migrations and `collectstatic` before Gunicorn. The frontend proxies `/api`, `/media`, `/admin`, and `/static` to the private backend, so the database and backend are not exposed as public ports.

After Render reports all services healthy:

1. Open the frontend HTTPS URL and verify `/login`.
2. In the backend service Shell, run:
   `python manage.py createsuperuser`
3. Sign in at `https://<frontend-domain>/admin/`.
4. Verify student, teacher, and admin logins in separate browser sessions.
5. Upload and download one small material to verify the persistent media disk.
6. Start one attendance session and confirm the worker closes it at the scheduled time.

## Custom domain

Attach the university domain to the public `mu-lms` frontend service only. Update `CSRF_TRUSTED_ORIGINS` to the final HTTPS origin before testing authentication.

Keep `SECURE_SSL_REDIRECT=0` on the private backend: TLS terminates at the public frontend and frontend-to-backend traffic uses Render's private network. Secure cookies remain enabled because `DEBUG=0` and the browser-facing origin is HTTPS.

## Backups

Render database backups and the media disk are separate. Define a retention policy for both before real student data is entered. Test restoration before launch.

## Rollback

Deploy the previous known-good Git commit from Render. Database migrations must remain backward-compatible; take a database backup before any destructive schema migration.
