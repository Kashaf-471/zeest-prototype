import json, secrets, hashlib, uuid, os, sys, csv, io
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from html.parser import HTMLParser
from typing import Literal
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Response,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
)
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from db import *
from security import hash_password, verify_password
from fixtures import SCENARIOS, findings, evidence
from speech import run_job
from workspace import overview, consultation_status, is_resumable
from services import (
    own_patient,
    own_encounter,
    audit,
    data,
    inputs,
    latest,
    snapshot,
    touch,
    lock_revision,
    generate_draft,
    review_draft,
    require_role,
)


@asynccontextmanager
async def lifespan(app):
    with SessionLocal.begin() as s:
        for j in s.scalars(
            select(Job).where(Job.status.in_(["PENDING", "PROCESSING"]))
        ):
            j.status = "FAILED"
            j.error = "Application restarted before transcription finished. Please submit the audio again."
    yield


app = FastAPI(title="Zeest clinical workspace", lifespan=lifespan)


def db():
    with SessionLocal() as s:
        try:
            yield s
            s.commit()
        except:
            s.rollback()
            raise


def fail(code, message):
    raise HTTPException(code, message)


def account(request: Request, s=Depends(db)):
    token = request.cookies.get("zeest_session", "")
    session = s.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires < now():
        fail(401, "Please log in.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if not secrets.compare_digest(
            request.headers.get("x-csrf-token", ""), session.csrf
        ):
            fail(403, "Invalid CSRF token. Refresh and retry.")
    request.state.session = session
    return s.get(Physician, session.physician_id)


def physician(u=Depends(account)):
    return require_role(u, "physician")


def administrator(u=Depends(account)):
    return require_role(u, "admin")


@app.middleware("http")
async def local_origin(request, call_next):
    origin = request.headers.get("origin")
    allowed = {
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    }
    if (
        request.method not in ("GET", "HEAD", "OPTIONS")
        and origin
        and origin not in allowed
    ):
        return JSONResponse({"detail": "Origin is not allowed."}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class MemoryQuery(BaseModel):
    encounter_id: int
    query: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=5, ge=1, le=10)
    mode: Literal["semantic", "keyword"] = "semantic"

    @field_validator("query")
    @classmethod
    def strip_memory_query(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter at least two characters to search prior records.")
        return value


@app.get("/api/workspace")
def workspace_overview(u=Depends(physician), s=Depends(db)):
    return overview(s, u)


class Register(Credentials):
    name: str = Field(min_length=2, max_length=100)

    @field_validator("name")
    @classmethod
    def valid_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Enter your full name.")
        return v.strip()


@app.post("/api/auth/register", status_code=201)
def register(body: Register, s=Depends(db)):
    email = str(body.email).lower()
    if s.scalar(select(Physician).where(Physician.email == email)):
        fail(409, "Email already registered.")
    p = Physician(name=body.name, email=email, password=hash_password(body.password))
    s.add(p)
    try:
        s.flush()
    except IntegrityError:
        fail(409, "Email already registered.")
    return {"message": "Account created. Please log in."}


@app.post("/api/auth/login")
def login(body: Credentials, response: Response, s=Depends(db)):
    p = s.scalar(select(Physician).where(Physician.email == str(body.email).lower()))
    if not p or not verify_password(body.password, p.password):
        fail(401, "Invalid email or password.")
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    s.add(
        LoginSession(
            id=hashlib.sha256(token.encode()).hexdigest(),
            physician_id=p.id,
            csrf=csrf,
            expires=(datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
        )
    )
    response.set_cookie(
        "zeest_session",
        token,
        httponly=True,
        samesite="strict",
        secure=False,
        max_age=43200,
        path="/",
    )
    return {"physician": data(p), "csrf": csrf}


@app.get("/api/auth/me")
def me(request: Request, u=Depends(account)):
    return {"physician": data(u), "csrf": request.state.session.csrf}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, u=Depends(account), s=Depends(db)):
    s.delete(request.state.session)
    response.delete_cookie("zeest_session", path="/")
    return {"message": "Logged out."}


_REPORT_MODULE_ROOT = Path(os.getenv("ZEEST_REPORT_MODULE_ROOT", str(Path(__file__).resolve().parents[3] / "zeest_FYP" / "Fyp-Zeest"))).resolve()
_REPORT_AGENT = None


class _ReportHTMLText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        elif tag in {"p", "div", "br", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden and data.strip():
            self.parts.append(data.strip())


def _extract_report_payload(payload, ext):
    if ext == ".pdf":
        try:
            import fitz
        except ModuleNotFoundError:
            return None, {"status": "unavailable", "method": "PyMuPDF unavailable", "issue": "Install PyMuPDF to extract selectable text from PDF files."}
        pages, pieces, offset = [], [], 0
        try:
            with fitz.open(stream=payload, filetype="pdf") as document:
                for page_number, page in enumerate(document, start=1):
                    page_text = page.get_text("text").strip()
                    if not page_text:
                        continue
                    if pieces:
                        pieces.append("\n")
                        offset += 1
                    start = offset
                    pieces.append(page_text)
                    offset += len(page_text)
                    pages.append({"page": page_number, "start": start, "end": offset})
        except Exception as exc:  # noqa: BLE001
            return None, {"status": "failed", "method": "PyMuPDF text layer", "issue": f"PDF extraction failed: {type(exc).__name__}."}
        text = "".join(pieces)
        if text:
            return text, {"status": "extracted", "method": "PyMuPDF text layer", "pages": pages}
        return None, {"status": "needs_ocr", "method": "PyMuPDF text layer", "issue": "PDF has no selectable text; OCR is required."}
    try:
        text = payload.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None, {"status": "failed", "method": "UTF-8 text decoding", "issue": "File is not valid UTF-8 text."}
    if ext in {".txt"}:
        return text, {"status": "extracted", "method": "UTF-8 text"}
    if ext in {".html", ".htm"}:
        parser = _ReportHTMLText()
        parser.feed(text)
        return " ".join("".join(parser.parts).split()), {"status": "extracted", "method": "HTML text extraction"}
    if ext == ".json":
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            return None, {"status": "failed", "method": "JSON field text", "issue": f"Invalid JSON at line {exc.lineno}, column {exc.colno}."}
        fields = []
        def collect(item, path="report"):
            if isinstance(item, dict):
                for key, child in item.items():
                    collect(child, f"{path}.{key}")
            elif isinstance(item, list):
                for index, child in enumerate(item):
                    collect(child, f"{path}[{index}]")
            elif item is not None and str(item).strip():
                fields.append(f"{path}: {str(item).strip()}")
        collect(value)
        return "\n".join(fields), {"status": "extracted", "method": "JSON field text"}
    if ext == ".csv":
        try:
            rows = list(csv.reader(io.StringIO(text)))
        except csv.Error as exc:
            return None, {"status": "failed", "method": "CSV cell text", "issue": f"Invalid CSV: {exc}."}
        return "\n".join(" | ".join(cell.strip() for cell in row) for row in rows), {"status": "extracted", "method": "CSV cell text"}
    return None, {"status": "unsupported", "method": "none", "issue": "Unsupported report format."}


def _get_report_agent():
    global _REPORT_AGENT
    if _REPORT_AGENT is None:
        if not (_REPORT_MODULE_ROOT / "zeest" / "report_nlp.py").is_file():
            fail(503, "Local Report NLP module is unavailable. Set ZEEST_REPORT_MODULE_ROOT to the Fyp-Zeest folder.")
        root = str(_REPORT_MODULE_ROOT)
        if root not in sys.path:
            sys.path.insert(0, root)
        from zeest.report_nlp import ReportNLPAgent
        try:
            _REPORT_AGENT = ReportNLPAgent()
        except RuntimeError:
            # The lexicon/context baseline has no transformer dependency.
            _REPORT_AGENT = ReportNLPAgent(load_local_model=False)
    return _REPORT_AGENT


@app.get("/api/research/report-experiments/results")
def report_experiment_results(u=Depends(physician)):
    results_path = _REPORT_MODULE_ROOT / "results" / "report_ner_training.json"
    if not results_path.is_file():
        fail(503, "Report NLP experiment results were not found in the module folder.")
    try:
        return json.loads(results_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail(503, "Report NLP experiment results could not be read.")


@app.post("/api/research/report-experiments/analyze")
async def analyze_report_experiment(text: str = Form(""), file: UploadFile | None = File(None), method: Literal["auto", "rules", "model"] = Form("auto"), u=Depends(physician)):
    report_text = text.strip()
    pages = None
    if file is not None and file.filename:
        filename = Path(file.filename).name
        ext = Path(filename).suffix.lower()
        if ext not in {".txt", ".pdf", ".html", ".htm", ".json", ".csv"}:
            fail(422, "Use a text, HTML, JSON, CSV or text-based PDF report. Images and scans are handled by the chest X-ray specialist.")
        payload = await file.read(5 * 1024 * 1024 + 1)
        if len(payload) > 5 * 1024 * 1024:
            fail(413, "Research report uploads are limited to 5 MB.")
        mime_by_ext = {".txt": "text/plain", ".pdf": "application/pdf", ".html": "text/html", ".htm": "text/html", ".json": "application/json", ".csv": "text/csv"}
        report_text, extraction = _extract_report_payload(payload, ext)
        pages = extraction.get("pages")
        if not report_text or not report_text.strip():
            fail(422, f"Could not extract report text: {extraction.get('issue', 'No selectable text was found in the file.')}")
    if not report_text:
        fail(422, "Paste report text or choose a text-based report file.")
    if len(report_text) > 100_000:
        fail(413, "Report text is limited to 100,000 characters.")
    agent = _get_report_agent()
    if method == "model" and agent.model is None:
        fail(503, "The trained local Report NLP checkpoint or its PyTorch/Transformers dependencies are missing. Install the optional report-model dependencies in the backend environment.")
    effective_method = "rules" if method == "auto" and agent.model is None else method
    result = agent.analyze_text(
        case_id="research-report-test",
        input_id=Path(file.filename).name if file and file.filename else "pasted-report-text",
        text=report_text,
        method=effective_method,
        page_offsets=pages,
        include_unmentioned_chest_labels=False,
    )
    if method == "auto" and agent.model is None:
        result["limitations"].append("Trained model dependencies are unavailable in this workspace; auto mode used the local rules baseline.")
    return {"result": result, "extraction": "PDF selectable-text extraction" if pages is not None else "pasted or decoded report text", "research_only": True}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "clinical_analysis": "simulated",
        "speech": "local faster-whisper",
    }


class AdminPatient(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    info: str = Field(min_length=3, max_length=5000)
    physician_id: int

    @field_validator("name", "info")
    @classmethod
    def strip_admin_text(cls, value):
        return value.strip()


class AdminConsultation(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str = Field(min_length=3, max_length=200)
    laboratory: str = Field(default="", max_length=20000)
    medication: str = Field(default="", max_length=20000)

    @field_validator("title", "laboratory", "medication")
    @classmethod
    def strip_title(cls, value):
        return value.strip()


def assigned_physician(s, physician_id):
    doctor = s.get(Physician, physician_id)
    if not doctor or doctor.role != "physician":
        fail(422, "Select a valid physician account.")
    return doctor


@app.get("/api/admin/workspace")
def admin_workspace(u=Depends(administrator), s=Depends(db)):
    doctors = list(
        s.scalars(
            select(Physician)
            .where(Physician.role == "physician")
            .order_by(Physician.name)
        )
    )
    patients = list(s.scalars(select(Patient).order_by(Patient.name)))
    consultations = list(
        s.scalars(select(Encounter).order_by(Encounter.date.desc(), Encounter.id.desc()))
    )
    by_patient = {}
    for consultation in consultations:
        source_rows = inputs(s, consultation.id)
        draft = latest(s, consultation.id)
        decision_count = len(
            list(
                s.scalars(
                    select(Decision).where(Decision.encounter_id == consultation.id)
                )
            )
        )
        lifecycle = consultation_status(
            consultation, len(source_rows), draft, decision_count
        )
        by_patient.setdefault(consultation.patient_id, []).append(
            dict(
                data(consultation),
                inputs=[data(source) for source in source_rows],
                lifecycle=lifecycle,
                resumable=is_resumable(lifecycle),
            )
        )
    doctor_names = {doctor.id: doctor.name for doctor in doctors}
    return {
        "physicians": [data(doctor) for doctor in doctors],
        "patients": [
            dict(
                data(patient),
                physician_name=doctor_names.get(patient.physician_id, "Unassigned"),
                consultations=by_patient.get(patient.id, []),
            )
            for patient in patients
        ],
    }


@app.post("/api/admin/patients", status_code=201)
def admin_create_patient(
    body: AdminPatient, u=Depends(administrator), s=Depends(db)
):
    assigned_physician(s, body.physician_id)
    patient = Patient(**body.model_dump())
    s.add(patient)
    s.flush()
    return data(patient)


@app.put("/api/admin/patients/{pid}")
def admin_update_patient(
    pid: int, body: AdminPatient, u=Depends(administrator), s=Depends(db)
):
    patient = s.get(Patient, pid)
    if not patient:
        fail(404, "Patient not found.")
    assigned_physician(s, body.physician_id)
    for key, value in body.model_dump().items():
        setattr(patient, key, value)
    s.flush()
    return data(patient)


@app.post("/api/admin/patients/{pid}/consultations", status_code=201)
def admin_create_consultation(
    pid: int, body: AdminConsultation, u=Depends(administrator), s=Depends(db)
):
    if not s.get(Patient, pid):
        fail(404, "Patient not found.")
    consultation = Encounter(
        patient_id=pid,
        **body.model_dump(exclude={"laboratory", "medication"}),
    )
    s.add(consultation)
    s.flush()
    for kind in ("laboratory", "medication"):
        content = getattr(body, kind)
        if not content:
            continue
        source = Input(encounter_id=consultation.id, kind=kind, content=content)
        s.add(source)
        s.flush()
        audit(s, u, consultation, "ADMIN_INPUT", source.id, kind)
    return data(consultation)


@app.get("/api/patients")
def patients(u=Depends(physician), s=Depends(db)):
    return [
        data(p) for p in s.scalars(select(Patient).where(Patient.physician_id == u.id))
    ]


@app.get("/api/patients/{pid}")
def patient(pid: int, u=Depends(physician), s=Depends(db)):
    p = own_patient(s, pid, u)
    consultations = list(
        s.scalars(
            select(Encounter)
            .where(Encounter.patient_id == pid)
            .order_by(Encounter.date.desc())
        )
    )

    def consultation_row(consultation):
        source_rows = inputs(s, consultation.id)
        draft_rows = list(
            s.scalars(
                select(Draft)
                .where(Draft.encounter_id == consultation.id)
                .order_by(Draft.id)
            )
        )
        decision_rows = list(
            s.scalars(select(Decision).where(Decision.encounter_id == consultation.id))
        )
        lifecycle = consultation_status(
            consultation,
            len(source_rows),
            draft_rows[-1] if draft_rows else None,
            len(decision_rows),
        )
        return dict(
            data(consultation),
            source_count=len(source_rows),
            note_count=sum(row.kind == "notes" for row in source_rows),
            input_count=sum(
                row.kind in ("imaging", "clinical_report", "laboratory", "medication")
                for row in source_rows
            ),
            draft_count=len(draft_rows),
            decision_count=len(decision_rows),
            latest_status=draft_rows[-1].status if draft_rows else None,
            lifecycle=lifecycle,
            resumable=is_resumable(lifecycle),
        )

    return {
        "patient": data(p),
        "encounters": [consultation_row(row) for row in consultations],
    }


@app.get("/api/research/patient-memory/results")
def patient_memory_experiment_results(u=Depends(physician)):
    results_path = _REPORT_MODULE_ROOT / "results" / "patient_memory_semantic_eval.json"
    if not results_path.is_file():
        fail(503, "Patient Memory synthetic evaluation results are not available yet.")
    try:
        return json.loads(results_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail(503, "Patient Memory evaluation results could not be read.")


_PATIENT_MEMORY_SCORER = None


def _get_patient_memory_scorer():
    global _PATIENT_MEMORY_SCORER
    if _PATIENT_MEMORY_SCORER is not None:
        return _PATIENT_MEMORY_SCORER
    model_dir = _REPORT_MODULE_ROOT / "models" / "patient_memory_medembed"
    if not (model_dir / "model.safetensors").is_file():
        fail(503, "The local MedEmbed checkpoint is missing. Download it with `python -m zeest.download_patient_memory_model` from the Fyp-Zeest folder.")
    root = str(_REPORT_MODULE_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    try:
        from zeest.semantic_embeddings import MedEmbedScorer
        _PATIENT_MEMORY_SCORER = MedEmbedScorer(model_dir=model_dir, device="cpu")
    except (ImportError, OSError, RuntimeError, ValueError) as exc:
        fail(503, f"The local MedEmbed model could not be loaded ({type(exc).__name__}). Check the patient-memory model dependencies and checkpoint files.")
    return _PATIENT_MEMORY_SCORER


def _memory_datetime(encounter):
    """Give date-only visits a deterministic UTC instant, ordered by saved ID."""
    try:
        day = datetime.fromisoformat(encounter.date.replace("Z", "+00:00"))
    except ValueError:
        fail(422, "This encounter has an unsupported date and cannot be used as a memory cutoff.")
    if day.tzinfo is None:
        day = day.replace(tzinfo=timezone.utc)
    else:
        day = day.astimezone(timezone.utc)
    return (day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(microseconds=encounter.id)).isoformat().replace("+00:00", "Z")


def _memory_source_text(source):
    content = source.content or ""
    if source.kind == "notes":
        try:
            value = json.loads(content)
        except (TypeError, json.JSONDecodeError):
            value = {}
        if isinstance(value, dict):
            text = "\n".join(f"{key}: {str(item).strip()}" for key, item in value.items() if item and str(item).strip())
        else:
            text = str(value)
    elif source.kind == "clinical_report":
        try:
            value = json.loads(content)
        except (TypeError, json.JSONDecodeError):
            value = {}
        text = value.get("source_text", "") if isinstance(value, dict) else ""
        if not text and isinstance(value, dict):
            result = value.get("result") or {}
            text = "\n".join(str(finding.get("explanation", "")) for finding in result.get("findings", []) if isinstance(finding, dict))
    else:
        text = content
    text = str(text or "").strip()
    if source.filename and (not text or text.startswith(("Provided during consultation setup", "No simulated analysis mapped"))):
        return ""
    return text


@app.post("/api/patients/{pid}/memory")
def patient_memory(pid: int, body: MemoryQuery, u=Depends(physician), s=Depends(db)):
    p = own_patient(s, pid, u)
    reference = s.get(Encounter, body.encounter_id)
    if not reference or reference.patient_id != p.id:
        fail(404, "Encounter not found for this patient.")
    encounters = list(s.scalars(select(Encounter).where(Encounter.patient_id == p.id).order_by(Encounter.date, Encounter.id)))
    eligible = [row for row in encounters if _memory_datetime(row) < _memory_datetime(reference)]
    eligible_ids = {row.id for row in eligible}
    source_rows = list(s.scalars(select(Input).where(Input.encounter_id.in_(eligible_ids)).order_by(Input.id))) if eligible_ids else []
    root = str(_REPORT_MODULE_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    from zeest.patient_memory import Encounter as MemoryEncounter
    documents = []
    for source in source_rows:
        encounter = next(row for row in eligible if row.id == source.encounter_id)
        text = _memory_source_text(source)
        if not text:
            continue
        label = source.filename or source.kind.replace("_", " ").title()
        uri = f"/api/inputs/{source.id}/file" if source.file else f"input://{source.id}"
        documents.append(MemoryEncounter(
            encounter_id=str(encounter.id), patient_id=str(p.id), physician_id=str(u.id),
            occurred_at=_memory_datetime(encounter), text=f"{label}: {text}", source_uri=uri,
        ))
    root = str(_REPORT_MODULE_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    from zeest.patient_memory import PatientMemoryAgent

    scorer = _get_patient_memory_scorer() if body.mode == "semantic" and documents else None
    agent = PatientMemoryAgent(documents, semantic_scorer=scorer.score if scorer else None)
    cutoff = _memory_datetime(reference)
    case = {
        "case_id": f"patient-{p.id}-encounter-{reference.id}", "patient_id": str(p.id),
        "physician_id": str(u.id), "index_time": cutoff,
        "context": {"memory_query": body.query},
    }
    mode = "semantic" if body.mode == "semantic" else "lexical"
    result = agent.analyze(case, query=body.query, top_k=body.top_k, mode=mode)
    keyword_hits = agent.retrieve(
        patient_id=str(p.id), physician_id=str(u.id), query=body.query,
        index_time=cutoff, top_k=body.top_k, mode="lexical",
    )
    return {
        "result": result, "query": body.query, "retrieval_mode": body.mode,
        "model": ({"name": scorer.name, "revision": scorer.revision, "local": True}
                  if scorer else None),
        "keyword_baseline": keyword_hits,
        "as_of_encounter": {"id": reference.id, "date": reference.date, "title": reference.title},
        "indexed_sources": len(documents),
    }


@app.get("/api/encounters/{eid}")
def encounter(eid: int, u=Depends(physician), s=Depends(db)):
    e = own_encounter(s, eid, u)
    source_rows = inputs(s, eid)
    draft_rows = list(
        s.scalars(
            select(Draft).where(Draft.encounter_id == eid).order_by(Draft.id.desc())
        )
    )
    decision_count = len(
        list(s.scalars(select(Decision).where(Decision.encounter_id == eid)))
    )
    lifecycle = consultation_status(
        e,
        len(source_rows),
        draft_rows[0] if draft_rows else None,
        decision_count,
    )
    return {
        "encounter": dict(
            data(e), lifecycle=lifecycle, resumable=is_resumable(lifecycle)
        ),
        "patient": data(own_patient(s, e.patient_id, u)),
        "inputs": [data(i) for i in source_rows],
        "drafts": [data(d) for d in draft_rows],
        "findings": [
            data(f)
            for f in s.scalars(
                select(Finding)
                .where(Finding.encounter_id == eid)
                .order_by(Finding.id.desc())
            )
        ],
        "jobs": [
            data(j) for j in s.scalars(select(Job).where(Job.encounter_id == eid))
        ],
    }


@app.get("/api/encounters/{eid}/history")
def history(eid: int, u=Depends(physician), s=Depends(db)):
    return snapshot(s, own_encounter(s, eid, u))


class Notes(BaseModel):
    expected_version: int
    transcript: str = Field(max_length=50000)
    subjective: str = Field(default="", max_length=10000)
    objective: str = Field(default="", max_length=10000)
    assessment: str = Field(default="", max_length=10000)
    plan: str = Field(default="", max_length=10000)


@app.post("/api/encounters/{eid}/notes")
def save_notes(eid: int, b: Notes, u=Depends(physician), s=Depends(db)):
    e = lock_revision(s, eid, u)
    if e.version != b.expected_version:
        fail(409, "Sources changed. Reload before saving notes.")
    value = b.model_dump(exclude={"expected_version"})
    if not any(x.strip() for x in value.values()):
        fail(422, "Enter notes before saving.")
    i = Input(encounter_id=eid, kind="notes", content=json.dumps(value))
    s.add(i)
    s.flush()
    touch(s, e)
    audit(s, u, e, "SAVE_NOTES", i.id)
    return {"input": data(i), "version": e.version}


class StructuredInput(BaseModel):
    kind: Literal["laboratory", "medication"]
    content: str = Field(min_length=3, max_length=20000)

    @field_validator("content")
    @classmethod
    def content_valid(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("Enter usable input content.")
        return v.strip()


@app.post("/api/encounters/{eid}/inputs")
def save_input(eid: int, b: StructuredInput, u=Depends(physician), s=Depends(db)):
    e = own_encounter(s, eid, u)
    i = Input(encounter_id=eid, kind=b.kind, content=b.content)
    s.add(i)
    s.flush()
    touch(s, e)
    audit(s, u, e, "SAVE_INPUT", i.id, b.kind)
    return data(i)


UPLOADS = DATA / "uploads"
UPLOADS.mkdir(exist_ok=True)
AUDIO = {".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac", ".mp4"}


def validate_file(content, ext, audio):
    if audio:
        valid = (
            (ext == ".wav" and content[:4] == b"RIFF" and content[8:12] == b"WAVE")
            or (ext in {".mp3"} and (content[:3] == b"ID3" or content[:1] == b"\xff"))
            or (ext in {".m4a", ".mp4"} and content[4:8] == b"ftyp")
            or (ext == ".webm" and content[:4] == bytes.fromhex("1a45dfa3"))
            or (ext == ".ogg" and content[:4] == b"OggS")
            or (ext == ".flac" and content[:4] == b"fLaC")
        )
    else:
        valid = (
            (ext == ".png" and content[:8] == b"\x89PNG\r\n\x1a\n")
            or (ext in {".jpg", ".jpeg"} and content[:3] == b"\xff\xd8\xff")
            or (ext == ".pdf" and content[:5] == b"%PDF-")
            or (ext in {".txt", ".html", ".htm", ".json", ".csv"} and b"\x00" not in content)
        )
    if not valid:
        fail(422, "File contents do not match a supported format.")


async def store_file(file, s, e, kind, *, payload=None):
    ext = Path(file.filename or "").suffix.lower()
    report_types = {".txt", ".pdf", ".html", ".htm", ".json", ".csv"}
    if kind == "clinical_report":
        allowed = report_types
    elif kind == "imaging":
        allowed = {".png", ".jpg", ".jpeg"}
    else:
        allowed = {".png", ".jpg", ".jpeg", ".pdf", ".txt"}
    if ext not in (AUDIO if kind == "audio" else allowed):
        fail(422, "Unsupported file type for this upload category.")
    content = payload if payload is not None else await file.read(20 * 1024 * 1024 + 1)
    if not content or len(content) > 20 * 1024 * 1024:
        fail(413, "Upload must be nonempty and at most 20 MB.")
    validate_file(content, ext, kind == "audio")
    filename = uuid.uuid4().hex + ext
    (UPLOADS / filename).write_bytes(content)
    i = Input(
        encounter_id=e.id,
        kind=kind,
        content="No simulated analysis mapped to this input",
        file=filename,
        filename=Path(file.filename or "upload").name[:255],
    )
    s.add(i)
    s.flush()
    touch(s, e)
    return i


@app.post("/api/encounters/{eid}/uploads")
async def upload(
    eid: int,
    kind: Literal["imaging", "laboratory", "medication", "document", "clinical_report"] = Form(
        "imaging"
    ),
    file: UploadFile = File(...),
    u=Depends(physician),
    s=Depends(db),
):
    own_encounter(s, eid, u)
    fail(403, "Clinical files are supplied by an administrator.")


class AdminClinicalReport(BaseModel):
    text: str = Field(min_length=3, max_length=100000)

    @field_validator("text")
    @classmethod
    def strip_report_text(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Enter at least three characters of report text.")
        return value


def _analyze_report_text(encounter_id, input_id, text, pages=None):
    agent = _get_report_agent()
    result = agent.analyze_text(
        case_id=f"encounter-{encounter_id}",
        input_id=str(input_id),
        text=text,
        method="auto",
        page_offsets=pages,
        include_unmentioned_chest_labels=False,
    )
    if agent.model is None:
        result["limitations"].append(
            "Trained model dependencies are unavailable in this backend; auto mode used the local rules baseline."
        )
    return result


@app.post("/api/admin/consultations/{eid}/reports", status_code=201)
def admin_report_text(eid: int, body: AdminClinicalReport, u=Depends(administrator), s=Depends(db)):
    e = s.get(Encounter, eid)
    if not e:
        fail(404, "Consultation not found.")
    item = Input(encounter_id=e.id, kind="clinical_report", content="")
    s.add(item)
    s.flush()
    result = _analyze_report_text(e.id, item.id, body.text)
    item.content = json.dumps({
        "research_only": True,
        "source_text": body.text,
        "extraction": "administrator-entered report text",
        "result": result,
    }, ensure_ascii=True)
    touch(s, e)
    audit(s, u, e, "ADMIN_UPLOAD", item.id, "Report NLP extraction saved from entered text")
    return data(item)


@app.post("/api/admin/consultations/{eid}/uploads", status_code=201)
async def admin_upload(
    eid: int,
    kind: Literal["imaging", "laboratory", "medication", "document", "clinical_report"] = Form(...),
    file: UploadFile = File(...),
    u=Depends(administrator),
    s=Depends(db),
):
    e = s.get(Encounter, eid)
    if not e:
        fail(404, "Consultation not found.")
    report_payload = None
    report_content = "Provided during consultation setup by the administrator."
    if kind == "clinical_report":
        report_payload = await file.read(5 * 1024 * 1024 + 1)
        if not report_payload or len(report_payload) > 5 * 1024 * 1024:
            fail(413, "Clinical report uploads must be nonempty and at most 5 MB.")
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".txt", ".pdf", ".html", ".htm", ".json", ".csv"}:
            fail(422, "Clinical report uploads must be TXT, PDF, HTML, JSON or CSV.")
        mime_by_ext = {
            ".txt": "text/plain", ".pdf": "application/pdf",
            ".html": "text/html", ".htm": "text/html",
            ".json": "application/json", ".csv": "text/csv",
        }
        validate_file(report_payload, ext, False)
        report_text, extraction = _extract_report_payload(report_payload, ext)
        if report_text and report_text.strip():
            agent = _get_report_agent()
            result = agent.analyze_text(
                case_id=f"encounter-{e.id}",
                input_id=Path(file.filename or "clinical-report").name,
                text=report_text,
                method="auto",
                page_offsets=extraction.get("pages"),
            )
            if agent.model is None:
                result["limitations"].append(
                    "Trained model dependencies are unavailable in this backend; upload-time auto mode used the local rules baseline."
                )
            report_content = json.dumps({
                "research_only": True,
                "source_text": report_text,
                "extraction": extraction.get("method", "text"),
                "result": result,
            }, ensure_ascii=True)
        else:
            report_content = json.dumps({
                "research_only": True,
                "status": extraction.get("status", "unavailable"),
                "extraction": extraction,
                "result": None,
                "message": extraction.get("issue", "No report text was extracted."),
            }, ensure_ascii=True)
    i = await store_file(file, s, e, kind, payload=report_payload)
    i.content = report_content
    s.flush()
    audit(s, u, e, "ADMIN_UPLOAD", i.id, "Report NLP extraction saved" if kind == "clinical_report" else kind)
    return data(i)


@app.get("/api/inputs/{iid}/file")
def file_download(iid: int, u=Depends(account), s=Depends(db)):
    i = s.get(Input, iid)
    if not i:
        fail(404, "Input not found.")
    if u.role == "physician":
        own_encounter(s, i.encounter_id, u)
    elif u.role != "admin":
        fail(403, "File access is not permitted.")
    if not i.file:
        fail(404, "No file attached.")
    return FileResponse(
        UPLOADS / i.file,
        filename=i.filename,
        content_disposition_type="inline" if i.kind == "audio" else "attachment",
    )


@app.post("/api/encounters/{eid}/transcribe", status_code=202)
async def transcription(
    eid: int,
    tasks: BackgroundTasks,
    file: UploadFile = File(...),
    stream: str = Form(..., min_length=1, max_length=64),
    sequence: int = Form(..., ge=0),
    u=Depends(physician),
    s=Depends(db),
):
    e = own_encounter(s, eid, u)
    old = s.scalar(
        select(Job).where(
            Job.encounter_id == eid, Job.stream == stream, Job.sequence == sequence
        )
    )
    if old:
        return data(old)
    i = await store_file(file, s, e, "audio")
    j = Job(
        id=uuid.uuid4().hex,
        encounter_id=eid,
        input_id=i.id,
        stream=stream,
        sequence=sequence,
    )
    s.add(j)
    s.flush()
    audit(s, u, e, "TRANSCRIBE", i.id, f"{stream}:{sequence}")
    s.commit()
    tasks.add_task(run_job, j.id)
    return data(j)


@app.get("/api/jobs/{jid}")
def job(jid: str, u=Depends(physician), s=Depends(db)):
    j = s.get(Job, jid)
    if not j:
        fail(404, "Job not found.")
    own_encounter(s, j.encounter_id, u)
    return data(j)


@app.get("/api/scenarios")
def scenarios(u=Depends(physician)):
    return [{"id": k, "label": v["label"]} for k, v in SCENARIOS.items()]


class Scenario(BaseModel):
    scenario: Literal["respiratory", "routine"]


@app.post("/api/encounters/{eid}/findings")
def analyse(eid: int, b: Scenario, u=Depends(physician), s=Depends(db)):
    e = own_encounter(s, eid, u)
    result = findings(inputs(s, eid), b.scenario)
    for f in result:
        s.add(
            Finding(
                encounter_id=eid,
                input_id=f["input_id"],
                scenario=b.scenario,
                content=f["finding"],
                source_version=e.version,
            )
        )
    audit(s, u, e, "SIMULATED_FINDINGS", detail=b.scenario)
    return {"scenario": b.scenario, "findings": result}


@app.post("/api/encounters/{eid}/drafts")
def generate(eid: int, b: Scenario, u=Depends(physician), s=Depends(db)):
    return generate_draft(s, eid, u, b)


class Review(BaseModel):
    revision_id: int
    action: Literal["MODIFY", "APPROVE", "REJECT"]
    diagnosis: str = Field(default="", max_length=20000)
    treatment: str = Field(default="", max_length=20000)
    reason: str = Field(default="", max_length=2000)


@app.post("/api/encounters/{eid}/review")
def review(eid: int, b: Review, u=Depends(physician), s=Depends(db)):
    return review_draft(s, eid, u, b)


@app.get("/api/encounters/{eid}/records")
def records(eid: int, u=Depends(physician), s=Depends(db)):
    own_encounter(s, eid, u)
    return {
        "decisions": [
            data(d)
            for d in s.scalars(select(Decision).where(Decision.encounter_id == eid))
        ],
        "audit": [
            dict(data(a), physician=s.get(Physician, a.physician_id).name)
            for a in s.scalars(
                select(Audit).where(Audit.encounter_id == eid).order_by(Audit.id.desc())
            )
        ],
    }
