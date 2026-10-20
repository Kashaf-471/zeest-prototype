# Frontend redesign

The 21 October 2026 revision replaces the earlier flat interface with a complete physician workspace. The user's redesign instruction supersedes the earlier visual treatment and My Patients landing page. Clinical scope, local inference and physician ownership remain unchanged.

## Information architecture

Login opens Dashboard. Persistent navigation provides Dashboard, My Patients, Review Queue, Patient Records and Workspace Guide. Patient selection leads to encounter history, then a four-step encounter workspace: Consultation, Clinical Inputs, Review and Patient Records. Global records collect approved decisions; encounter records provide the decision's local context and audit trail.

Dashboard values come from the authenticated `/api/workspace` endpoint. Counts reflect saved records, not invented activity or appointments. Loading uses placeholders rather than temporary zero counts. Resume encounter is stored separately for each physician. Logout and account switching clear displayed workspace state.

## Interaction and HCI decisions

| Principle | Implemented behaviour |
|---|---|
| Visibility of system status | Recording/processing status, actual microphone input level, saved/unsaved indicators, pending/approved/rejected states and loading feedback |
| Consistency | Shared sidebar, breadcrumb, patient context, numbered encounter steps, page headings, buttons and confirmation patterns |
| Recognition over recall | Patient search, encounter history, source checklist, task instructions and visible next-step controls |
| Progressive disclosure | Transcript and structured-note tabs; recordings, note revisions, source snapshots and draft history expand when needed |
| Error prevention | Unsaved-link navigation confirmation, browser unload warning, read-only notes during recognition, stale-draft explanation and explicit approval/rejection confirmation |
| User control | Cancel edits, stay on a dirty page, deliberately discard changes, modify/reject/approve separately, show/hide password and dismiss notifications |
| Error recovery | Clear search, empty-state next actions, missing-record recovery links and an in-app troubleshooting guide |
| Accessibility | Landmarks, skip link, visible focus, semantic tabs with arrow/Home/End navigation, modal focus handling, mobile navigation focus trap/Escape and reduced-motion styling |
| Readability | Consistent spacing and typography, stronger text contrast, human-readable dates and source panels instead of raw JSON |
| Responsive use | Collapsible sidebar, wrapped encounter steps, stacked panels and narrow forms without document overflow |

Clinical simulation remains visible in the shell and relevant result panels. Decorative artwork is reused from the supplied assets. The microphone meter uses captured PCM amplitude; it is not a fabricated waveform.

## Validation

- Production Next.js build and TypeScript checks passed.
- Nine backend integration tests passed, including overview ownership and counts.
- Seven browser tests passed, including the full clinical workflow, real local speech upload, virtual microphone streaming, search, unsaved changes, keyboard tabs and mobile navigation.
- Axe checks with WCAG 2 A/AA and 2.1 AA tags reported zero violations on the nine tested authentication/dashboard/patient/clinical/records/guide pages.
- Desktop and 390-pixel layouts were captured and visually reviewed. Tests check document overflow, page errors and external browser requests.

Automated accessibility checks are scoped evidence, not a complete accessibility certification or a clinical usability study. Physical microphone hardware remains untested. Existing clinical fixture limitations still apply.

## Source structure

- `frontend/app/[[...slug]]/page.tsx`: authenticated application state, persisted operations, recording and navigation guards.
- `frontend/app/components/workspace-view.tsx`: shell, authentication and notifications.
- `frontend/app/components/overview-view.tsx`: dashboard, directory, worklist, patient profile, global decisions and guide.
- `frontend/app/components/encounter-view.tsx`: four-step encounter workflow.
- `frontend/app/components/ui.tsx`: shared icons, statuses, headings, sources and encounter rows.
- `frontend/app/globals.css`: visual system, responsive rules and accessible interaction styling.
- `backend/workspace.py`: authenticated overview aggregation.
