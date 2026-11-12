# Zeest physician workspace

Open **http://127.0.0.1:3000**. After logging in, you arrive at the Dashboard.

## Start locally

Open two PowerShell terminals at this workspace root. If both servers are already running, simply refresh the browser.

**Terminal 1: backend**

```powershell
.\backend\start.ps1
```

To run both the workstation's Report NLP checkpoint and Patient Memory's local MedEmbed model, use system Python instead:

```powershell
python .\backend\start_report_model.py --port 8000
```

This launcher uses system Python's installed PyTorch, Transformers, and Sentence Transformers plus the backend virtual environment's app dependencies. Run `python -m pip install -e .[patient-memory-model]` and `python -m zeest.download_patient_memory_model` from `../zeest_FYP/Fyp-Zeest` once before using semantic search. The normal `start.ps1` remains available for non-model workflows and exact keyword Patient Memory search.

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
| `admin@example.com` | `ZeestAdmin!2026` |

The administrator registers synthetic patients, assigns or reassigns physicians and creates consultations. Physicians document and review only their assigned patients.

On the login screen, expand **Explore with a demo physician** to fill a demo account. Then select **Log In**. Newly registered accounts have an empty patient directory.

## Where to go

- **Dashboard:** real record counts, recent stored encounters, activity and Resume encounter.
- **My Patients:** search your assigned patients, open a profile and choose an encounter.
- **Review Queue:** current drafts waiting for your decision.
- **Patient Records:** approved decisions across your patients, with links to their audit trails.
- **Patient Memory:** search only earlier saved records with local MedEmbed semantic ranking or compare the exact keyword baseline. A patient needs at least two visits with saved text sources; for the seeded demonstration, choose Amina Noor, set the cutoff to the latest visit, and search for `cough`.
- **Workspace Guide:** short instructions and help with recording, drafts and saved records.

On a phone or narrow window, use the menu button at the top left.

## Complete an encounter

1. **Consultation:** record or upload audio. Wait for the final transcript, correct it, enter Structured Notes and select Save Notes.
2. **Clinical Inputs:** review imaging, laboratory, medication and other documents supplied by the administrator when the consultation was created.
3. **Review:** select a demo scenario and generate a draft. Read Evidence and Critic Findings. Modify saves a pending revision. Reject records no accepted decision. Approve asks for explicit confirmation.
4. **Patient Records:** inspect approved decisions and the audit history for that encounter.

Patient identity and encounter date stay above every step. Saved/unsaved indicators show whether edits are stored. Leaving a page with unsaved work asks for confirmation.

## Real and simulated

Accounts, ownership checks, records, uploads, local speech recognition, saved notes, review actions and audit history are functional and persisted. Patient Memory runs the pinned MedEmbed-small checkpoint locally and preserves the exact keyword search as a comparison baseline. Its four-query synthetic paraphrase benchmark is a software check only, not clinical retrieval validation. The model is already fine-tuned upstream; Zeest does not further train it on the synthetic patient records. Clinical findings, diagnosis/treatment drafts, evidence and critic remain explicitly labelled fixed simulations.

## If something goes wrong

- **Cannot connect:** check both terminals. Frontend uses port 3000; backend uses port 8000.
- **Microphone blocked:** allow browser permission or choose an audio file. Physical microphone hardware has not been verified here.
- **Speech model unavailable:** from `backend/`, run `.\.venv\Scripts\python.exe speech_setup.py`, then restart the backend.
- **Outdated draft:** generate a fresh draft after changing source notes or inputs.
- **No matching patients:** clear the directory search. A new account has no assigned patients.

[Developer setup and tests](docs/DEVELOPMENT.md) ? [Verification results](VERIFICATION.md) ? [Frontend design decisions](FRONTEND_REDESIGN.md)


## Local Report NLP experiments

The physician workspace includes a separate **Model Experiments** page to test the local report text extractor with synthetic text, TXT, HTML, JSON, CSV, and selectable-text PDF files. This experimental endpoint is separate from clinical findings, drafts, review, and patient records. It does not handle images or scanned PDFs. Chest X-ray uploads remain assigned to the separate Imaging Agent. Do not submit real patient information.

By default, the backend expects the modular project at `../zeest_FYP/Fyp-Zeest` relative to this checkout. If needed, set `ZEEST_REPORT_MODULE_ROOT` to that folder. The page displays `results/report_ner_training.json` when authenticated. `auto` uses the rules and available local checkpoint, `rules` forces the baseline, and `model` requires `models/report_ner`. The benchmark uses PubMed abstracts and is not clinical-report validation.


### Admin upload to physician Report NLP record

During consultation setup, administrators can paste **clinical report text** or upload a **Clinical report** file (TXT, selectable-text PDF, HTML, JSON or CSV). The local Report NLP module extracts terms and assertion/context, then saves the structured result with the consultation source. The assigned physician sees it under **Patient Records > Report NLP**, including quoted source spans and limitations. Scanned PDFs are retained and marked as needing OCR. Chest X-rays remain in their separate PNG/JPEG upload and are not read by Report NLP.


### Patient Memory model and experiment

The Patient Memory screen uses `abhinand/MedEmbed-small-v0.1` at pinned revision `40a5850d046cfdb56154e332b4d7099b63e8d50e`, loaded from the local `Fyp-Zeest/models/patient_memory_medembed/` folder. It is not downloaded during a patient query and does not send patient text to a hosted service. The synthetic paraphrase benchmark currently reports Recall@1/MRR of 1.00/1.00 for MedEmbed and 0.25/0.25 for the keyword baseline over four authored queries. This tiny result demonstrates the software path only; it does not establish clinical performance. A similarity score ranks source text and is not a disease probability.
