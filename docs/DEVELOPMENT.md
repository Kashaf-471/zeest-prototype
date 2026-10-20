# Developer setup and implementation details

A working local physician workspace with persisted synthetic records, real local speech recognition and fixed, clearly labelled clinical scenarios. The handoff defines this prototype; the proposal/report describe the eventual research system. Reference files are unchanged. No commits, pushes or deployment were performed.

## Start on this computer

Dependencies, demo records and speech weights are already installed. Open two PowerShell terminals at the workspace root.

Terminal 1:

```powershell
.\backend\start.ps1
```

Terminal 2:

```powershell
cd frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev
```

Open **http://127.0.0.1:3000**. FastAPI runs at **http://127.0.0.1:8000**, with API documentation at `/docs`. Use the frontend for login/recording and keep the same hostname throughout a session.

| Demo physician | Password |
|---|---|
| `doctor1@example.com` | `ZeestDemo!2026` |
| `doctor2@example.com` | `ZeestDemo!2026` |

Each physician owns three disjoint synthetic patients; the first has two encounters. New registrations have no patients. There is no patient creation, reassignment, administrator, patient account or evaluation page.

## Fresh installation

Verified with Windows, Python **3.13.5** and Node **22.13.1**. Dependencies are pinned in `backend/requirements.lock` and `frontend/package-lock.json`.

```powershell
.\backend\setup.ps1
cd frontend
npm ci
```

Setup creates the virtual environment, installs dependencies, applies migrations, seeds idempotently and downloads speech weights. Existing records are retained. If scripts are blocked, run these commands directly from `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe seed.py
$env:HF_HUB_DISABLE_XET = '1'
.\.venv\Scripts\python.exe speech_setup.py
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Then start the frontend in another terminal. For a production-mode local build, run `npm run build`, then `npm run start` in `frontend/`. Stop the frontend before rebuilding it.

## Try the workflow

1. Log in to the Dashboard, choose My Patients, inspect encounter history and open an encounter.
2. Allow microphone access, record and stop, or upload audio. Independent PCM/WAV chunks are transcribed approximately every eight seconds. Stopping transcribes the full recording to reconcile boundaries. Audio is playable.
3. Correct the transcript and manually enter Subjective, Objective, Assessment and Plan. Save Notes creates a revision. Recognition does not infer SOAP, speakers or clinical interpretation; original job text remains separate from corrections.
4. Save laboratory values with units, medication context and an imaging/document upload. Arbitrary files receive **No simulated analysis mapped to this input**.
5. In Findings, select a demo scenario and load fixed simulated findings. Findings retain source IDs, scenario and source version.
6. Generate a simulated draft in Review. Inspect fictional illustrative evidence, simulated critic, source snapshot and actual stored history. Scenario selection controls fixed clinical text, not analysis of new inputs.
7. Modify to create a PENDING revision. Rejection creates no accepted decision. Explicit confirmation approves the exact saved revision. Changed sources/newer drafts block stale review; repeated approval returns the existing decision.
8. Inspect approved decisions and append-only audit in Patient Records. Restarting retains records; logout invalidates the session.

## Feature status

| Area | Implementation |
|---|---|
| Accounts | Real validation, salted scrypt hashes, persisted sessions, login/logout |
| Access | Server ownership checks on records, encounters, files, jobs, inputs, findings and drafts |
| Notes/history | Real source revisions, corrections and longitudinal relational queries |
| Recording/speech | Real PCM capture, playable WAV, ordered local recognition and final reconciliation |
| Speech verification | Synthetic upload and virtual microphone tested; physical microphone untested |
| Structured notes | Manually editable fields; no automatic SOAP inference |
| Uploads | Private storage, 20 MB limit, format/header checks and authorised downloads |
| Clinical findings | Fixed simulated scenarios; arbitrary files are not diagnosed |
| Memory | Real sources/approved decisions; no genuine semantic search or vector embeddings |
| Diagnosis/treatment | Fixed scenario drafts and literal physician edits with source snapshots |
| Evidence/critic | Fictional illustrative passages and fixed simulated critic; no clinical validation |
| Review/audit | Revision checks, approval transaction, rejection, duplicate prevention and append-only audit |

SQLite replaces the report's eventual PostgreSQL/pgvector design. `DATABASE_URL` is configurable through SQLAlchemy. PostgreSQL requires a driver, migration review and separate verification; it was not tested here. No hosted LLM, cloud speech, research actor or deployment is included.

## Local speech

The adapter follows the [official faster-whisper implementation](https://github.com/SYSTRAN/faster-whisper). Setup downloads `Systran/faster-whisper-tiny.en` from Hugging Face. Its model binary is about 75.5 MB plus tokenizer/config files. Cache: `backend/data/models/`. Runtime uses `local_files_only=True`; speech is processed locally.

Environment options are documented in `backend/.env.example`. Set them in the shell before setup/startup. The backend does not automatically load `.env` files.

```powershell
$env:WHISPER_MODEL = 'tiny.en'
$env:WHISPER_DEVICE = 'cpu'
$env:WHISPER_COMPUTE_TYPE = 'int8'
$env:WHISPER_THREADS = '4'
$env:WHISPER_LANGUAGE = 'en'
```

`WHISPER_MODEL` also accepts an absolute compatible local model directory. Download a different model before using it offline. Recognition can err: Zeest was recognised as zest in the synthetic test. No clinical accuracy or multilingual claim is made.

Capture uses non-overlapping standalone WAV chunks, sequence IDs and a serial queue. Sequence-indexed text prevents repeated appends; full-audio recognition reconciles boundaries on stop. Boundary words may be imperfect beforehand. Recording stops after three minutes or nine million samples to keep the final WAV below the limit. Notes are read-only while recognition updates them. Navigation cancels capture/display updates; submitted audio/jobs remain stored.

Permission denial, silence, decode failure and missing weights have visible states. Interrupted jobs become FAILED on backend restart and are not automatically retried. Audio: WAV, MP3, M4A, WebM, OGG, FLAC, MP4. Documents: PNG, JPEG, PDF, TXT.

## Sessions and storage

Random session tokens are stored as SHA-256 hashes. Cookies are HttpOnly, SameSite Strict, expire after 12 hours and use `Secure=False` for local HTTP. Authenticated writes require a session CSRF token; foreign mutating Origins are rejected. Next.js proxies `/api` to FastAPI, so CORS is not enabled. Servers bind to loopback.

Records: `backend/data/zeest.db`. Private audio/uploads: `backend/data/uploads/`. Audit includes physician, patient, encounter, action, UTC timestamp and revision. SQLite triggers reject audit updates/deletes; there is no audit-edit API. This protects application integrity, not against someone controlling the database files.

Local data, weights, environments, generated WAV files, build output and screenshots are ignored by Git.

## Tests

Fast backend suite uses a temporary database:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Run the real model test separately to use the configured cache:

```powershell
.\tests\generate_speech.ps1
$env:ZEEST_REAL_SPEECH = '1'
$env:HF_HUB_OFFLINE = '1'
.\.venv\Scripts\python.exe -m pytest tests/test_speech_real.py -q -s
```

With both servers running, from `frontend/`:

```powershell
npm run typecheck
npm run test:e2e
```

Browser tests use installed Microsoft Edge headlessly, including a virtual microphone fed the labelled synthetic WAV. If Edge is unavailable, install Playwright Chromium and adjust the browser channel in the config and virtual-device test. Browser tests write demo records; API tests use temporary records. See [verification record](../VERIFICATION.md) for executed results.

For the separate process-restart check, run `python tests/verify_restart.py` using the backend virtual environment from `backend/`. It uses an isolated local database and an available loopback port.

## Reset and troubleshooting

Stop the backend, then run from the workspace root:

```powershell
.\backend\reset.ps1 -ConfirmReset
```

This resets the default local records/uploads, reapplies migrations and restores demo accounts. Cached weights remain. It does not reset a custom database/data directory.

- Backend unavailable: start FastAPI on port 8000, as expected by the proxy.
- Missing tables: run Alembic upgrade from `backend/`, or use `start.ps1`.
- Missing model: run `speech_setup.py` with internet for setup, then restart. For stalled downloads, set `HF_HUB_DISABLE_XET=1` and retry.
- Decoder errors: install the lockfile. PyAV 19 removed an option used by faster-whisper 1.2.1; the verified lock pins **PyAV 16.1.0**.
- No microphone: use localhost, allow permission and check the Windows input device, or upload audio. Physical microphone access was not tested here.
- Stale revision: reload notes or generate a fresh draft after source changes.
- Port conflict: stop existing servers before starting another instance on 3000/8000.

## Structure

`frontend/app/`: Next.js workspace, theme and PCM encoder. `backend/main.py`: API boundaries. `services.py`: ownership, source snapshots and review transitions. `speech.py`: local inference/jobs. `fixtures.py`: clinical fixtures. `db.py`: SQLAlchemy records. Alembic migrations, seed/reset commands, integration tests and browser tests are included.


The current frontend uses the Dashboard as its post-login destination. See the root README and FRONTEND_REDESIGN.md for the revised navigation and task flow.
