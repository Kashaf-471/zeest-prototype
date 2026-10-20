# Zeest local prototype: implementation handoff

Prepared for a separate application workspace. This is an implementation brief, not a report chapter.

## 1. What to put in the new folder

Create a separate `zeest-prototype/` folder. Do not build inside the report repository.

```text
zeest-prototype/
  PROTOTYPE_HANDOFF.md              # this document
  reference/
    F26-098.docx                    # original project scope
    report.pdf                     # latest full compiled report
    requirements.tex               # Chapter 4, useful for exact UC/FR wording
    design.tex                     # Chapter 6, background architecture
    ui/                            # existing exported HTML/CSS/assets
```

Copy from the current report repository:

- This file -> `PROTOTYPE_HANDOFF.md`.
- `F26-098.docx` -> `reference/F26-098.docx`.
- `Report template/build/Zeest-An-Agentic-Medical-Copilot-FYP-I.pdf` -> `reference/report.pdf`.
- `kashaf/04_software_requirement_specifications.tex` -> `reference/requirements.tex`.
- `esha/06_high_level_and_low_level_design.tex` -> `reference/design.tex`.
- The whole inner folder `kashaf/diagrams/stitch_zeest_clinical_support_system/stitch_zeest_clinical_support_system/` -> `reference/ui/`. Include `styles.css`, assets and every screen folder. A single `code.html` without its shared assets is insufficient.

You do not need the sample reports, LaTeX class, report build tools, bibliography, signatures or report-specific AGENTS.md. Keep reference files unchanged. Do not copy report ownership or paragraph-length rules into application development.

No new Stitch generation is necessary. Adapt the existing designs into reusable application components. The report screenshots show intended layouts, not an existing working application. Old exports or archived notes do not override this brief.

## 2. Authority and scope

The original proposal defines the eventual research project. The report explains intended requirements and design. This brief applies the user's newer implementation constraint: complete a locally runnable frontend and backend using synthetic records and deterministic simulated clinical outputs, with actual transcription and actual application state.

If the report describes Gemini, RAG, imaging inference, embeddings, agent frameworks or deployment, that describes the eventual system. Do not implement or call those services in this prototype. Record this distinction in the application README and feature-status matrix. Do not modify the report to claim that simulated processing is real.

Physician is the ONLY application actor. No administrator, patient login, researcher, evaluation user or additional account type. The student team and supervisor are project stakeholders, not application roles. Do not restore UC22, G16, a comparative-evaluation page or its navigation.

Use Zeest with capital Z. Avoid em dashes in interface text and documentation.

## 3. What is real and what is simulated

| Area | Required implementation |
|---|---|
| Frontend | Functional pages, navigation, forms, validations, tabs, dialogs and error states |
| Accounts | Real registration, password hashing, login, logout and persisted sessions |
| Patient access | Real server-side ownership checks on every related operation |
| Records | Real database persistence, encounter history and source/revision associations |
| Audio | Actual browser microphone capture, playable recording and real local transcription |
| Notes | Actual transcript display, correction and saved note revisions |
| Clinical inputs | Actual upload/input forms and persisted file or structured-data references |
| Analysis | Fixed synthetic imaging, laboratory and medication responses selected by demo scenario |
| Memory | Real patient history queries; simulated semantic relevance with fixed scenario mappings |
| Diagnosis/treatment | Hardcoded scenario-specific clinical drafts, not model-generated diagnoses |
| Evidence/critic | Explicitly labelled illustrative evidence and simulated critic findings |
| Review | Real modify/reject/approve actions, revision checks and transaction boundaries |
| Decisions/audit | Real persisted accepted decisions and append-only application audit history |
| Deployment | Local development only, no public hosting or production infrastructure |

Display one restrained global badge such as `Local demo | Simulated clinical analysis`. Label relevant result panels as simulated. Do not clutter every card with warnings, report IDs or framework names. Do not claim clinical validation or medical accuracy.

## 4. Recommended implementation baseline

Keep business logic in Python:

- Frontend: Next.js, TypeScript and reusable React components. Reuse the reference styling and artwork. Choose one simple styling approach rather than several UI libraries.
- Backend: Python, FastAPI, Pydantic, SQLAlchemy and database migrations.
- Local database: SQLite by default for simple startup, with an environment-configured database URL and a clean route to PostgreSQL. This is an explicit prototype simplification of the report's PostgreSQL/pgvector design. Document it. Do not install a vector database or simulate genuine vector embeddings.
- Transcription: a local faster-whisper adapter. Default to a small CPU-compatible model and configurable compute settings. Choose supported package versions, record them in lockfiles and verify the selected combination.
- Clinical processing: ordinary Python fixture services behind stable interfaces. No need to install LangGraph or Google ADK merely to return fixtures.
- Local file storage outside public/static directories; reference files through authorised backend routes.

No Gemini/OpenAI or other hosted LLM calls, no cloud speech API, no remote image analysis and no cloud deployment. Downloading dependencies or speech-model weights during setup is allowed; document those downloads and model cache location. After setup, speech processing should run locally. The speech model is the deliberate exception to the no-AI-service scope; it recognises actual audio, not clinical recommendations.

If SQLite cannot support a demonstrated requirement, explain the concrete reason before switching to local PostgreSQL. Do not silently introduce Docker, Redis, Celery, Kubernetes, managed authentication or additional infrastructure.

## 5. Pages and use-case coverage

Several use cases belong on the same page. Do not create 21 separate pages.

| Page or shared component | Use cases |
|---|---|
| Sign Up | UC01 |
| Log In and shared Log Out action | UC02, UC21 |
| My Patients | UC03 |
| Patient Details and Encounter History | UC04, UC05, UC06 |
| Consultation and editable notes | UC07, UC08 |
| Clinical Inputs tabs: imaging, laboratory, medications and findings | UC09, UC10, UC11, UC12 |
| Clinical Review with evidence and critic tabs | UC13, UC14, UC15 |
| Modify draft editor | UC16 |
| Explicit approval confirmation | UC17 |
| Rejection confirmation | UC18 |
| Patient Records tabs: approved decisions and audit history | UC19, UC20 |

Use stable routes with patient and encounter identifiers. Show selected patient/encounter context consistently. Start at My Patients after login; existing accounts need not register again. Reuse one physician layout, patient context bar, status component and decision dialog pattern.

Keep the calm teal/off-white reference theme, readable text, deliberate spacing and restrained icons. Use the supplied decorative authentication artwork. Avoid decorative charts, invented scan findings, random clinical numbers or giant empty panels. Ensure laptop-width usability, responsive forms, keyboard access, visible focus and loading/empty/error states.

## 6. Accounts and synthetic data

Seed at least two demo physician accounts with disjoint synthetic patient sets so ownership can be tested. Give each physician several patients and selected patients several encounters. Provide the actual demo credentials in the local README; never use real patient records.

Registration collects name, email and password. Validate required fields, email format and duplicate email; hash passwords. New accounts start with an empty patient list unless the user explicitly chooses a documented demo-data setup action. Do not quietly give new accounts access to existing physicians' patients.

Seed believable but clearly synthetic histories, lab panels and medication lists. A small fixed set of demo scenarios is sufficient. Seed records idempotently. Persist new registration, saved notes, uploads, drafts and decisions across restarts. Provide an explicit local reset command, never an automatic reset on application startup.

Do not invent patient creation, reassignment or management roles absent from this scope. Seeded records can support the initial patient workflow.

## 7. Real transcription requirements

Implement actual microphone permission, recording start/stop, recording state and playable captured audio. Send actual captured audio to the Python backend and transcribe it using the local speech model. Provide an audio-file upload fallback for hardware-independent testing.

Start with a verified record-stop-transcribe path. Then implement incremental transcript updates while recording, matching the eventual live consultation requirement. Use independently decodable audio chunks, for example PCM/WAV frames with sequence numbers, rather than assuming every MediaRecorder blob is independently decodable. Preserve chunk order, manage overlap if used, avoid duplicated text and reconcile the final transcript on stop. Do not claim low latency before measuring it.

Keep these concepts separate:

- Raw audio and recognised transcript: real outputs from the supplied recording.
- Structured note fields: editable fields filled manually or by simple documented rules.
- Clinical interpretation: fixture-based and explicitly simulated.

Speech recognition alone does not produce validated SOAP notes, diagnosis or speaker attribution. Do not fake those capabilities. Keep uncertain or unmapped text available for physician correction. Never replace a recording with a canned transcript. Handle denied permission, silence, decoding failure, unavailable model and failed processing visibly. Report any hardware or model-download limitation honestly.

Official implementation reference: https://github.com/SYSTRAN/faster-whisper . It supports local CPU/GPU inference; model weights must be obtained before offline use. Do not promise clinical speech accuracy or multilingual performance without testing.

## 8. Clinical workflow and simulation rules

A clinician selects their patient and encounter, reviews history, records a consultation, corrects notes, supplies inputs and requests a draft. The backend prepares a case from saved source revisions and retrieves that patient's actual stored history.

Use deterministic fixture adapters for imaging, labs, medications, evidence, reasoning and critic stages. Fixtures must be keyed by a known synthetic scenario and preserve patient/encounter/source identifiers. They must never mix patients. A generic new upload should be saved but shown as `No simulated analysis mapped to this input`, rather than falsely diagnosed using an unrelated fixture.

Changing a note or upload must not pretend to change the medical analysis intelligently. Record the selected scenario and source snapshot for every fixture draft. Provide an explicit demo scenario selector where needed, clearly labelled as a demo control rather than a new user role or research screen.

Do not fabricate real paper titles, DOI values or guideline citations. Use explicitly fictional illustrative evidence snippets with demo identifiers, or source-verified references supplied in the reference material. Never present a fictional citation as a real medical authority.

Implement draft states consistently: PENDING, REJECTED and APPROVED; a modification creates a new PENDING revision. Approval targets the exact saved revision, and only approval creates a clinical decision. Editing alone never records an accepted decision. Preserve the previous content and audit history. Prevent stale-revision approval and duplicate clinical decisions from repeated requests.

Use a database transaction to create the approval action, mark the revision and save the accepted decision. Rejection records the review action but creates no accepted decision. Future retrieval distinguishes actual source observations and approved decisions from unapproved generated content. Audit records include physician, patient, encounter, action, timestamp and revision identifier; they are not editable through the application.

## 9. Backend and persistence expectations

Keep routes thin and put ownership checks, transcription, fixture processing and review transitions in Python services. Enforce authentication and ownership on direct API access, not only on visible links. Use server-managed sessions with HttpOnly cookies and documented local cookie/CORS/CSRF settings. Logout invalidates the server session.

Persist these logical records, using the report data dictionary as a guide without forcing unnecessary complexity:

- Physician, session, patient and encounter.
- Clinical input, saved input revision, audio/upload reference and transcription job/status.
- Fixture finding and clinical draft revision with its source snapshot.
- Evidence/critic fixtures associated with the reviewed revision.
- Review action and accepted clinical decision.

Do not add an evaluation actor or evaluation UI. Evaluation metadata in the eventual research schema need not become prototype application tables unless required for an actual demonstrated feature.

Provide API groups for authentication, own patients/encounters/history, uploads/notes/transcription status, analysis fixtures, draft retrieval/modification/approval/rejection, approved decisions and audit history. Return consistent validation and error responses. Do not leak another physician's data by changing an identifier.

Validate upload type and size, assign server-generated storage names and never execute uploaded content. Do not log credentials or raw consultation contents unnecessarily. Keep secrets, local database files, audio uploads, model weights and build output out of Git.

## 10. Completion checks

Do not stop at static pages, API stubs or a plan. Complete these meaningful checks:

1. Registration, login, refresh persistence and logout work against the backend.
2. Two physician accounts cannot access each other's records, uploads, jobs or drafts.
3. Patient and encounter selection retain the correct context across pages.
4. Actual recorded or uploaded speech produces a real transcript that can be corrected and saved.
5. Incremental transcription works, or any remaining live-mode limitation is explicitly documented rather than disguised.
6. Input forms save actual data; mapped scenarios return clearly simulated findings and unknown uploads do not receive invented findings.
7. A draft can be modified, rejected and approved with correct revision-specific persistence.
8. Rejected or unapproved drafts never appear as accepted decisions.
9. Repeated approval cannot create duplicate decisions; stale approval is refused.
10. Audit history and approved decisions survive restarting the application.
11. No remote LLM/cloud speech calls occur in the clinical workflow.
12. All screens are reviewed in a browser at laptop and narrow widths; no dead links, clipped controls or fake success messages.

Test backend ownership and state transitions with integration tests. Test real transcription with a human-provided or properly labelled synthetic speech fixture, separately from fast mocked unit tests. Do not claim microphone verification if only a supplied audio file was tested.

## 11. Deliverables and work order

First inspect the references and existing workspace. Record a short implementation plan, assumptions and real/simulated feature matrix; then continue implementing without waiting for separate approval for every routine step.

Build in this order:

1. Project setup, shared theme, database, synthetic seeds and authentication.
2. Patient and encounter navigation with ownership enforcement.
3. Real record-stop-transcribe and saved notes, then incremental audio updates.
4. Clinical inputs and deterministic fixture processing.
5. Draft review, revision-safe decisions, approved records and audit history.
6. Browser review, meaningful tests and startup documentation.

Deliver `frontend/`, `backend/`, migrations, seed/reset commands, environment examples, dependency lockfiles, tests and a concise root README. Document Windows PowerShell setup and two-terminal local startup commands, ports, demo accounts, transcription model setup, troubleshooting and exact verification results. Keep one readable prototype structure; avoid unnecessary services and nested folders. Never commit secrets or push/deploy without instruction.

## 12. Paste this prompt into Codex in the NEW folder

```text
Build the complete local Zeest prototype in this workspace. Read PROTOTYPE_HANDOFF.md and every relevant file under reference/ first. The handoff defines the current prototype scope; the proposal and report describe the eventual research system, and reference/ui contains visual guidance rather than working application code.

Implement both the Next.js/TypeScript frontend and Python/FastAPI backend. Use persisted synthetic data and deterministic, clearly labelled clinical fixtures. Make registration, login/logout, physician-owned patient records, consultation recording, actual local speech-to-text, editable saved notes, uploads, draft revisions, approval/rejection, accepted decisions and audit history functional end to end.

Physician is the only application actor. No admin, patient account, research role or evaluation page. No hosted LLM calls, cloud speech calls or deployment. Local speech-model inference is required. Do not fake transcription or imply that hardcoded medical outputs analyse arbitrary new inputs. Reuse the existing simple GUI designs and assets; no fresh Stitch generation is required.

Begin with a short implementation plan and explicit assumptions, then carry the implementation through to a runnable, verified result. Follow the handoff's acceptance checks. If a dependency or microphone cannot be verified, report the precise limitation and finish unaffected work. Keep reference files unchanged. Finish with local startup commands, demo credentials, test results and a truthful list of implemented versus simulated features. Do not stop after scaffolding, a plan or static mockups. Do not commit, push or deploy.
```
