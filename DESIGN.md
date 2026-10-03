# Millat Umidi LMS design

This branch redesigns the integrated LMS for a proposal to Millat Umidi University. It is a concept prepared for presentation, not a claim of official university adoption.

## Visual source

Reference inspected: https://millatumidi.uz/ on 2026-10-03.

- Primary navy: #1B2A4A; deep navigation navy: #101D34.
- Gold accent: #C5A55A; background: #F8F7F4; white content surfaces.
- Typography: Sora headings and Inter interface text, self-hosted.
- University logo: https://millatumidi.uz/mu-logo.png
- University image: https://millatumidi.uz/assets/University%203.webp
- Reference CSS: https://millatumidi.uz/assets/index-DqrtH_bS.css

University assets retain their original ownership. This concept uses them to demonstrate a university-specific proposal. Font licenses are included under frontend/public/brand/licenses.

## Updated experience

Shared navigation across materials, assignments, grades, calendar and profile. Responsive mobile drawer. Uzbek login and registration. Accessible labels, keyboard focus, reduced-motion handling, empty and error states. Real dashboard counts use the API and do not invent enrollment statistics.

`/preview` shows clearly labeled, illustrative data for a design presentation. It requires no account and never creates a fake login or changes the database. Preview detail buttons show a sample dialog. Actual user data remains on protected routes.

The standalone MU-LMS-design-preview.html is an offline visual preview. Its local controls support navigation and sample detail dialogs; account login and uploads are only available in the full running project.

## Preservation

Integration baseline: master at e275182. Design changes: design/millat-umidi. No remote GitHub repository was changed or created.

## Commercial readiness

This change is a design and usability iteration, not a completed university-wide production rollout. Before sale/rollout, validate the implemented roles, course access and attendance with the institution; agree on additional reporting, academic processes and integrations. Deployment, backups, recovery and security validation remain separate work.

## Validation

TypeScript and production build are checked after the redesign. Backend was subsequently upgraded with course-scoped permissions, teaching workflows and attendance; see FEATURES.md and VERIFICATION.md. Local HTTP rendered the preview successfully. The available cloud browser blocked access to local addresses, so automated browser visual QA and mobile interaction QA were not completed; responsive layouts are implemented in CSS and should be reviewed in the target browsers before acceptance.
