# Zeest physician workspace

Open **http://127.0.0.1:3000**. After logging in, you arrive at the Dashboard.

## Start locally

Open two PowerShell terminals at this workspace root. If both servers are already running, simply refresh the browser.

**Terminal 1: backend**

```powershell
.\backend\start.ps1
```

**Terminal 2: frontend**

```powershell
cd frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev
```

For a fresh install, first run `.\backend\setup.ps1`, then run `npm ci` in `frontend/`.

## Sign in

| Account | Password |
|---|---|
| `doctor1@example.com` | `ZeestDemo!2026` |
| `doctor2@example.com` | `ZeestDemo!2026` |

On the login screen, expand **Explore with a demo physician** to fill a demo account. Then select **Log In**. Newly registered accounts have an empty patient directory.

## Where to go

- **Dashboard:** real record counts, recent stored encounters, activity and Resume encounter.
- **My Patients:** search your assigned patients, open a profile and choose an encounter.
- **Review Queue:** current drafts waiting for your decision.
- **Patient Records:** approved decisions across your patients, with links to their audit trails.
- **Workspace Guide:** short instructions and help with recording, drafts and saved records.

On a phone or narrow window, use the menu button at the top left.

## Complete an encounter

1. **Consultation:** record or upload audio. Wait for the final transcript, correct it, enter Structured Notes and select Save Notes.
2. **Clinical Inputs:** add documents, laboratory information and medication context. Save each entry. The source checklist shows what is stored.
3. **Review:** select a demo scenario and generate a draft. Read Evidence and Critic Findings. Modify saves a pending revision. Reject records no accepted decision. Approve asks for explicit confirmation.
4. **Patient Records:** inspect approved decisions and the audit history for that encounter.

Patient identity and encounter date stay above every step. Saved/unsaved indicators show whether edits are stored. Leaving a page with unsaved work asks for confirmation.

## Real and simulated

Accounts, ownership checks, records, uploads, local speech recognition, saved notes, review actions and audit history are functional and persisted. Clinical findings, diagnosis/treatment drafts, evidence and critic are explicitly labelled fixed simulations. They do not analyse arbitrary new inputs.

## If something goes wrong

- **Cannot connect:** check both terminals. Frontend uses port 3000; backend uses port 8000.
- **Microphone blocked:** allow browser permission or choose an audio file. Physical microphone hardware has not been verified here.
- **Speech model unavailable:** from `backend/`, run `.\.venv\Scripts\python.exe speech_setup.py`, then restart the backend.
- **Outdated draft:** generate a fresh draft after changing source notes or inputs.
- **No matching patients:** clear the directory search. A new account has no assigned patients.

[Developer setup and tests](docs/DEVELOPMENT.md) ? [Verification results](VERIFICATION.md) ? [Frontend design decisions](FRONTEND_REDESIGN.md)
