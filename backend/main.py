import json, secrets, hashlib, uuid
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
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
from workspace import overview
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


app = FastAPI(title="Zeest local prototype", lifespan=lifespan)


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


def physician(request: Request, s=Depends(db)):
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
def me(request: Request, u=Depends(physician)):
    return {"physician": data(u), "csrf": request.state.session.csrf}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, u=Depends(physician), s=Depends(db)):
    s.delete(request.state.session)
    response.delete_cookie("zeest_session", path="/")
    return {"message": "Logged out."}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "clinical_analysis": "simulated",
        "speech": "local faster-whisper",
    }


@app.get("/api/patients")
def patients(u=Depends(physician), s=Depends(db)):
    return [
        data(p) for p in s.scalars(select(Patient).where(Patient.physician_id == u.id))
    ]


@app.get("/api/patients/{pid}")
def patient(pid: int, u=Depends(physician), s=Depends(db)):
    p = own_patient(s, pid, u)
    return {
        "patient": data(p),
        "encounters": [
            data(e)
            for e in s.scalars(
                select(Encounter)
                .where(Encounter.patient_id == pid)
                .order_by(Encounter.date.desc())
            )
        ],
    }


@app.get("/api/encounters/{eid}")
def encounter(eid: int, u=Depends(physician), s=Depends(db)):
    e = own_encounter(s, eid, u)
    return {
        "encounter": data(e),
        "patient": data(own_patient(s, e.patient_id, u)),
        "inputs": [data(i) for i in inputs(s, eid)],
        "drafts": [
            data(d)
            for d in s.scalars(
                select(Draft).where(Draft.encounter_id == eid).order_by(Draft.id.desc())
            )
        ],
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
            or (ext == ".txt" and b"\x00" not in content)
        )
    if not valid:
        fail(422, "File contents do not match a supported format.")


async def store_file(file, s, e, kind):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (
        AUDIO if kind == "audio" else {".png", ".jpg", ".jpeg", ".pdf", ".txt"}
    ):
        fail(422, "Unsupported file type.")
    content = await file.read(20 * 1024 * 1024 + 1)
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
    eid: int, file: UploadFile = File(...), u=Depends(physician), s=Depends(db)
):
    e = own_encounter(s, eid, u)
    i = await store_file(file, s, e, "imaging")
    audit(s, u, e, "UPLOAD", i.id)
    return data(i)


@app.get("/api/inputs/{iid}/file")
def file_download(iid: int, u=Depends(physician), s=Depends(db)):
    i = s.get(Input, iid)
    if not i:
        fail(404, "Input not found.")
    own_encounter(s, i.encounter_id, u)
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
