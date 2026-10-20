# Verification record

## Frontend revision on 21 October 2026

The redesigned frontend passed the production build and TypeScript checks, nine backend integration tests and all seven browser tests (1.1 minutes). The expanded browser suite verifies Dashboard counts, directory search, unsaved-change confirmation, keyboard tabs, mobile navigation, recording/transcription and the complete draft decision workflow. Automated axe checks reported zero WCAG 2 A/AA and 2.1 AA tag violations across the nine tested pages. Desktop and 390-pixel screenshots were visually reviewed. This is scoped automated evidence, not an accessibility certification. Existing saved records were retained during this revision. See FRONTEND_REDESIGN.md and the current README for the revised navigation.

The following sections retain the initial implementation verification record for context. Its initial five-test browser count and database reset describe the original build, not a reset performed during this frontend revision.

Executed locally on 21 October 2026, Asia/Karachi. Windows, Python 3.13.5, Node 22.13.1, Next.js 16.4.2, React 19.3.1, TypeScript 7.0.2, FastAPI 0.156.2, SQLAlchemy 2.1.5, faster-whisper 1.2.1, CTranslate2 4.8.3 and PyAV 16.1.0. Exact transitive versions are locked.

## Executed results

| Check | Result |
|---|---|
| `npm run build` | Passed, including Next.js TypeScript compilation |
| `npm run typecheck` | Passed |
| Backend `python -m pytest -q` | 8 passed, 1 intentionally skipped real-model test, 3.80 seconds |
| Separate offline real speech test | 1 passed, 1.79 seconds |
| `npm run test:e2e` | 5 passed, 25.7 seconds, headless Microsoft Edge |
| `python tests/verify_restart.py` | Passed real process stop/start, same session, notes, file, decision and audit |
| UI screenshots | Laptop 1366x900 and narrow 390x844; reviewed readable layouts and wrapping |

The backend tests exercise registration, invalid/duplicate data, sessions and logout; two-physician ownership including direct file/job/draft access; saved inputs; unsupported files; unknown upload findings; CSRF and Origin rejection; modification, rejection, stale revision/source refusal; repeat and concurrent approval; transaction rollback after injected decision insertion failure; append-only audit; silent/failed jobs and repeated chunk IDs. Speech is mocked only in fast API tests and is explicitly tested separately with the real model.

The five browser tests cover registration and duplicate registration, empty new accounts, real uploaded synthetic speech with correction/save/refresh, PCM recording through a virtual microphone with an incremental transcript and final reconciliation, denied permission with file fallback, and the full patient/input/modify/reject/approve/records workflow. The workflow also checks for page errors, external browser requests and narrow document overflow. No external browser requests occurred in that clinical workflow.

The real restart test uses a separate generated database under `backend/.test-data/`, starts a backend subprocess, saves a note/file, approves a draft, terminates the process, starts it again and verifies the same authenticated client and identical accepted-decision/audit records. It recovered one decision and four audit events.

## Real speech evidence

The test fixture is a **synthetic voice**, generated locally with Windows System.Speech by `backend/tests/generate_speech.ps1`. It is 12.22 seconds long, with this text:

> This is a synthetic consultation recording for the Zeest local prototype. The patient reports a cough for three days. The physician will review the notes before saving.

The actual local model output was:

> This is a synthetic consultation recording for the zest local prototype. The patient reports a cough for three days. The physician will review the notes before saving.

The separate run took 1.37 seconds for recognition/model setup within that test process. This is one synthetic English example, not a clinical accuracy or general latency benchmark. A separate three-second silent WAV produced an empty transcript. The real test was run with `HF_HUB_OFFLINE=1`; the adapter also requires locally cached files at runtime.

The browser virtual microphone supplied synthetic audio through the actual browser capture API. It exercised PCM collection, independent WAV chunks, sequence ordering, backend recognition, playable final audio and saved notes. It does **not** establish physical microphone access, human conversational recognition, speaker attribution or clinical speech accuracy.

PyAV 19.0.1 initially failed because its `av.open` no longer accepted `metadata_errors`, which faster-whisper 1.2.1 passes. Pinning PyAV 16.1.0 resolved the failure and all real speech checks above passed. An initial model download stalled through Xet; `HF_HUB_DISABLE_XET=1` completed setup.

## Acceptance checks

| Handoff check | Evidence |
|---|---|
| 1. Accounts, refresh and logout | API and browser tests; same session across process restart |
| 2. Ownership | Negative direct API checks for patients, encounters, histories, files, jobs, uploads, inputs, drafts and review |
| 3. Patient/encounter context | ID-based routes, visible context, selected encounter navigation and browser workflow |
| 4. Actual transcript, corrections and saved notes | Real speech upload, browser correction/save/refresh and persisted raw transcript |
| 5. Incremental recognition | Virtual microphone test observes chunk recognition before stopping, then final reconciliation |
| 6. Saved inputs and honest fixtures | Persisted structured inputs/uploads, explicit scenario controls, unknown uploads unmapped |
| 7. Revision-specific review | API and browser modification/rejection/approval |
| 8. Rejected/unapproved exclusion | Decision queries and transition tests |
| 9. Duplicate/stale refusal | Repeat approval, concurrent requests, changed source and stale revision tests |
| 10. Restart persistence | Separate backend process restart test |
| 11. Local inference only | Offline real model test, runtime adapter local-only loading, source inspection and no external browser workflow requests |
| 12. Browser review | Functional screens at laptop/narrow widths, visible errors, native confirmation dialogs and no page errors |

Generated screenshots and JSON evidence are in ignored `verification/`. Browser tests mutate only synthetic demo records. The delivered default database is reset to its initial two physicians and six patients after testing; test-generated approvals remain available in the isolated restart/API test databases.

## Remaining limits

- Physical microphone hardware and human speech have not been verified.
- Clinical findings, relevance assumptions, diagnosis/treatment, evidence and critic are fixed simulations. They do not interpret arbitrary new inputs. No medical authority, diagnostic accuracy or clinical safety validation is claimed.
- Notes are manually structured. No automatic SOAP extraction, diarisation, real semantic retrieval, embeddings, RAG or imaging inference is implemented.
- Live chunks are non-overlapping and can lose words at boundaries; the final full-audio pass reconciles the transcript. Queue delay depends on the local CPU; no low-latency service guarantee is made.
- Jobs run in the local backend process. Restarted unfinished jobs become FAILED and need resubmission. This is not a durable background-worker deployment.
- PostgreSQL, other speech models, GPU execution and multilingual performance were not tested.
- This is a local prototype with synthetic data, not a deployed clinical product.
