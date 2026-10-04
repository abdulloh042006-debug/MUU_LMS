# Security & Business Logic Audit — 2026-10-04

Scope: IDOR/access boundaries, assignment deadlines, submission uploads, course-list DB query scaling, and a quick stored-XSS sink review.

## IDOR / object access

Status: PASS with regression coverage.

- Students only see their own submissions through the assignment submission-history endpoint.
- Student grade lists are restricted to the authenticated student.
- Grade mutation is teacher/admin only and resolves the target submission through the teacher's scoped courses.
- A teacher guessing a submission ID from another teacher's course receives 404.
- There is no direct public `/api/submissions/<id>/` detail endpoint.
- Protected uploaded files use the same course/submission scoping and return 404 to unauthorized users.

## Deadline and submission mutation

Status: PASS.

- New submissions after the deadline are rejected when `allow_late=False`.
- `allow_late=True` remains an explicit teacher-controlled business rule.
- Submission history has no PUT/PATCH mutation path; replacement attempts return 405.
- PostgreSQL submission attempts are protected with `select_for_update()` plus a database unique constraint.

## File upload hardening

Status: HARDENED.

- Student Submission files are limited to 10 MB.
- Course/material attachment validation remains capped at 20 MB.
- Submission extensions use an allowlist: PDF, Office documents, text/table formats, supported images, and ZIP.
- Active/dangerous extensions such as `.html`, `.svg`, `.js`, `.exe`, and `.sh` are rejected.
- Protected files are served as attachments with `X-Content-Type-Options: nosniff`.

Residual production requirements:

- Extension validation is not malware/content scanning. A renamed malicious file can still require antivirus/content inspection.
- Serializer limits do not replace a reverse-proxy request-body limit. Production ingress should reject oversized HTTP bodies before Django parses them.
- ZIP archives are stored/downloaded, not extracted by the application. If server-side extraction is ever introduced, archive-bomb and path-traversal protections will be required.

## N+1 / course list

Status: PASS.

`CourseListAPIView` and course detail already use:

`select_related('teacher').prefetch_related('students')`

A regression test compares the DB query count for 1 course versus 21 courses and verifies that query count does not scale with course count.

## Quick XSS sink review

- Normal React-rendered user text is escaped by React.
- No feedback/announcement flow currently injects raw HTML.
- One `dangerouslySetInnerHTML` exists in the reusable chart UI helper for generated CSS. The chart helper is currently unused by application pages, so no current user-data exploit path was identified.
- Future code must not pass untrusted user-controlled values into raw HTML/CSS sinks without validation/sanitization.

## Verification

- Full Django integration suite: 21/21 PASS after the IDOR, deadline, upload and N+1 regression tests were added.
- Focused post-hardening security suite: 5/5 PASS after the protected-download `nosniff` change.
- `python manage.py check`: PASS.
- `makemigrations --check --dry-run`: no model changes.
