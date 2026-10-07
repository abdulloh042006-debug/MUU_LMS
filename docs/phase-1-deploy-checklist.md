# Phase 1 deployment checklist

## Before deploy

- Confirm the deployment branch and commit SHA.
- Confirm `DJANGO_SECRET_KEY`, `DATABASE_URL`, and `ALLOWED_HOSTS` are configured for the target environment.
- Confirm the deployment token is current. If the preview log reports `The specified token is not valid`, refresh the Vercel preview/deployment token in the project environment; do not change application code.

## Deploy

1. Deploy the frontend and backend from the same commit.
2. Run migrations before serving traffic: `python manage.py migrate --noinput`.
3. Run static collection: `python manage.py collectstatic --noinput`.
4. Verify `GET /api/health/` returns HTTP 200 and `{\"status\":\"ok\",\"database\":\"ok\"}`.
5. Record the deployment URL, commit SHA, migration result, and health response.

## If health or API checks fail

- Stop promotion and capture the failing URL, method, response body, timestamp, timezone, deployment SHA, and Vercel request ID.
- Check the backend logs for the matching request ID before changing code.
- If a migration caused the failure, redeploy the previous known-good commit and restore the database only through a reviewed migration procedure.
- Do not delete production data or run destructive rollback SQL automatically.

## Smoke checks

- Authenticated calendar list for teacher and student.
- Teacher lesson start and test-mode start.
- Student active attendance read.
- Student check-in rejection for expired, duplicate, unauthorized, and invalid-proof requests.
