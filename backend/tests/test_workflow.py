import os, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
test_root = Path(__file__).resolve().parents[1] / ".test-data"
test_root.mkdir(exist_ok=True)
os.environ["ZEEST_DATA_DIR"] = tempfile.mkdtemp(prefix="zeest-tests-", dir=test_root)
from alembic.config import Config
from alembic import command
from db import *

config = Config(str(ROOT / "alembic.ini"))
config.set_main_option("script_location", str(ROOT / "migrations"))
command.upgrade(config, "head")
from seed import seed

seed()
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def clients():
    with TestClient(app) as a, TestClient(app) as b:
        for n, c in [(1, a), (2, b)]:
            r = c.post(
                "/api/auth/login",
                json={"email": f"doctor{n}@example.com", "password": "ZeestDemo!2026"},
            )
            assert r.status_code == 200, r.text
            c.headers["x-csrf-token"] = r.json()["csrf"]
        yield a, b


def context(c):
    p = c.get("/api/patients").json()[0]
    e = c.get(f"/api/patients/{p['id']}").json()["encounters"][0]
    return p["id"], e["id"]


def generate(c, e):
    r = c.post(f"/api/encounters/{e}/drafts", json={"scenario": "respiratory"})
    assert r.status_code == 200, r.text
    return r.json()


def review(c, e, d, action, **kwargs):
    return c.post(
        f"/api/encounters/{e}/review",
        json={"revision_id": d["id"], "action": action, **kwargs},
    )


def test_registration_session_logout(clients):
    a, b = clients
    r = a.post(
        "/api/auth/register",
        json={
            "name": "New Physician",
            "email": "new@example.com",
            "password": "Password!123",
        },
    )
    assert r.status_code == 201
    assert (
        a.post(
            "/api/auth/register",
            json={
                "name": "New",
                "email": "new@example.com",
                "password": "Password!123",
            },
        ).status_code
        == 409
    )
    assert (
        a.post(
            "/api/auth/register",
            json={"name": "New", "email": "bad", "password": "short"},
        ).status_code
        == 422
    )
    c = TestClient(app)
    r = c.post(
        "/api/auth/login", json={"email": "new@example.com", "password": "Password!123"}
    )
    assert r.status_code == 200
    c.headers["x-csrf-token"] = r.json()["csrf"]
    assert c.get("/api/patients").json() == []
    assert c.get("/api/auth/me").status_code == 200
    token = c.cookies.get("zeest_session")
    assert c.post("/api/auth/logout").status_code == 200
    c.cookies.set("zeest_session", token)
    assert c.get("/api/auth/me").status_code == 401
    assert (
        c.post(
            "/api/auth/login",
            json={"email": "new@example.com", "password": "WrongPass123"},
        ).status_code
        == 401
    )


def test_ownership_inputs_jobs_drafts(clients, monkeypatch):
    a, b = clients
    p, e = context(a)
    import speech

    monkeypatch.setattr(
        speech, "transcribe", lambda path: "mock speech for API ownership test only"
    )
    import io, wave

    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        w.writeframes(b"\0\0" * 16000)
    job = a.post(
        f"/api/encounters/{e}/transcribe",
        files={"file": ("test.wav", out.getvalue(), "audio/wav")},
        data={"stream": "ownership", "sequence": "0"},
    ).json()
    d = generate(a, e)
    for path in [
        f"/patients/{p}",
        f"/encounters/{e}",
        f"/encounters/{e}/history",
        f"/encounters/{e}/records",
        f"/jobs/{job['id']}",
        f"/inputs/{job['input_id']}/file",
    ]:
        assert b.get("/api" + path).status_code == 404, path
    for path, body in [
        (f"/encounters/{e}/drafts", {"scenario": "routine"}),
        (f"/encounters/{e}/review", {"revision_id": d["id"], "action": "APPROVE"}),
        (f"/encounters/{e}/inputs", {"kind": "laboratory", "content": "test"}),
    ]:
        assert b.post("/api" + path, json=body).status_code == 404
    assert (
        b.post(
            f"/api/encounters/{e}/uploads",
            files={"file": ("other.txt", b"test", "text/plain")},
        ).status_code
        == 404
    )
    assert (
        b.post(
            f"/api/encounters/{e}/transcribe",
            files={"file": ("x.wav", out.getvalue(), "audio/wav")},
            data={"stream": "bad", "sequence": "0"},
        ).status_code
        == 404
    )
    assert a.get(f"/api/jobs/{job['id']}").json()["status"] == "COMPLETED"
    assert a.get(f"/api/inputs/{job['input_id']}/file").content == out.getvalue()


def test_research_report_endpoint_rejects_images_without_touching_clinical_flow(clients):
    doctor, _ = clients
    response = doctor.post("/api/research/report-experiments/analyze", files={"file": ("scan.jpg", b"\xff\xd8\xff\xdb" + b"0" * 20, "image/jpeg")}, data={"method": "rules"})
    assert response.status_code == 422
    assert "chest X-ray specialist" in response.json()["detail"]


def test_revision_approval_rejection_and_restart(clients):
    a, b = clients
    p, e = context(a)
    d = generate(a, e)
    changed = review(
        a,
        e,
        d,
        "MODIFY",
        diagnosis="Physician revised synthetic diagnosis",
        treatment="Physician revised plan",
    )
    assert changed.status_code == 200, changed.text
    new = changed.json()["draft"]
    assert new["status"] == "PENDING"
    assert review(a, e, d, "APPROVE").status_code == 409
    assert not a.get(f"/api/encounters/{e}/records").json()["decisions"]
    assert (
        review(a, e, new, "REJECT", reason="Requires more information").status_code
        == 200
    )
    assert not a.get(f"/api/encounters/{e}/records").json()["decisions"]
    assert review(a, e, new, "APPROVE").status_code == 409
    accepted = generate(a, e)
    assert review(a, e, accepted, "APPROVE").status_code == 200
    assert review(a, e, accepted, "APPROVE").status_code == 200
    rec = a.get(f"/api/encounters/{e}/records").json()
    assert len(rec["decisions"]) == 1
    assert json_content(rec["decisions"][0])["diagnosis"] == accepted["diagnosis"]
    assert [x["action"] for x in rec["audit"]].count("APPROVE") == 1
    engine.dispose()
    assert len(a.get(f"/api/encounters/{e}/records").json()["decisions"]) == 1
    with SessionLocal() as s:
        from sqlalchemy import text

        with pytest.raises(Exception):
            s.execute(text("UPDATE audit SET action='BAD'"))
            s.commit()


def json_content(row):
    import json

    return json.loads(row["content"])


def test_source_changes_block_stale_draft_and_notes(clients):
    a, b = clients
    p, e = context(a)
    d = generate(a, e)
    version = a.get(f"/api/encounters/{e}").json()["encounter"]["version"]
    assert (
        a.post(
            f"/api/encounters/{e}/notes",
            json={"expected_version": version, "transcript": "Real source note"},
        ).status_code
        == 200
    )
    assert review(a, e, d, "APPROVE").status_code == 409
    assert (
        a.post(
            f"/api/encounters/{e}/notes",
            json={"expected_version": version, "transcript": "Stale edit"},
        ).status_code
        == 409
    )


def test_physician_inputs_are_editable_and_csrf_is_enforced(clients):
    a, _ = clients
    _, e = context(a)
    assert a.post(
        f"/api/encounters/{e}/uploads", files={"file": ("bad.exe", b"bad")}
    ).status_code == 403
    saved = a.post(
        f"/api/encounters/{e}/inputs",
        json={"kind": "laboratory", "content": "Physician supplied value"},
    )
    assert saved.status_code == 200
    assert saved.json()["content"] == "Physician supplied value"
    token = a.headers.pop("x-csrf-token")
    assert (
        a.post(f"/api/encounters/{e}/drafts", json={"scenario": "routine"}).status_code
        == 403
    )
    a.headers["x-csrf-token"] = token
    assert (
        a.post(
            f"/api/encounters/{e}/drafts",
            json={"scenario": "routine"},
            headers={"origin": "https://untrusted.example"},
        ).status_code
        == 403
    )


def test_concurrent_approval_creates_one_decision(clients):
    from concurrent.futures import ThreadPoolExecutor

    a, b = clients
    p = a.get("/api/patients").json()[1]
    e = a.get(f"/api/patients/{p['id']}").json()["encounters"][0]["id"]
    d = generate(a, e)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: review(a, e, d, "APPROVE"), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    records = a.get(f"/api/encounters/{e}/records").json()
    assert len([x for x in records["decisions"] if x["draft_id"] == d["id"]]) == 1
    assert (
        len(
            [
                x
                for x in records["audit"]
                if x["action"] == "APPROVE" and x["revision_id"] == d["id"]
            ]
        )
        == 1
    )


def test_approval_failure_rolls_back_action_status_and_decision(clients):
    from sqlalchemy import event

    a, b = clients
    p, e = context(a)
    d = generate(a, e)

    def reject_insert(*args):
        raise RuntimeError("Injected decision persistence failure")

    event.listen(Decision, "before_insert", reject_insert)
    try:
        with pytest.raises(RuntimeError, match="Injected decision persistence failure"):
            review(a, e, d, "APPROVE")
    finally:
        event.remove(Decision, "before_insert", reject_insert)
    current = a.get(f"/api/encounters/{e}").json()["drafts"][0]
    assert current["id"] == d["id"] and current["status"] == "PENDING"
    records = a.get(f"/api/encounters/{e}/records").json()
    assert not [x for x in records["decisions"] if x["draft_id"] == d["id"]]
    assert not [
        x
        for x in records["audit"]
        if x["action"] == "APPROVE" and x["revision_id"] == d["id"]
    ]


def test_transcription_silence_failure_and_idempotent_chunk(clients, monkeypatch):
    import io, wave, speech

    a, b = clients
    p, e = context(a)
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        w.writeframes(b"\0\0" * 16000)

    def send(stream):
        return a.post(
            f"/api/encounters/{e}/transcribe",
            files={"file": ("silence.wav", out.getvalue(), "audio/wav")},
            data={"stream": stream, "sequence": "0"},
        )

    monkeypatch.setattr(speech, "transcribe", lambda path: "")
    silent = send("silence")
    assert silent.status_code == 202
    result = a.get("/api/jobs/" + silent.json()["id"]).json()
    assert result["status"] == "SILENCE" and result["transcript"] == ""
    assert send("silence").json()["id"] == silent.json()["id"]

    def broken(path):
        raise RuntimeError("Decoder unavailable in test")

    monkeypatch.setattr(speech, "transcribe", broken)
    failed = send("failure")
    result = a.get("/api/jobs/" + failed.json()["id"]).json()
    assert (
        result["status"] == "FAILED"
        and "RuntimeError" in result["error"]
        and result["transcript"] == ""
    )


def test_workspace_overview_is_owner_scoped_and_reports_real_counts(clients):
    a, b = clients
    for client in (a, b):
        response = client.get("/api/workspace")
        assert response.status_code == 200
        summary = response.json()
        ids = {p["id"] for p in client.get("/api/patients").json()}
        assert {p["id"] for p in summary["patients"]} == ids
        assert summary["metrics"]["patients"] == len(ids)
        assert all(e["patient_id"] in ids for e in summary["encounters"])
        assert all(d["patient_id"] in ids for d in summary["decisions"])
        assert all(event["patient_id"] in ids for event in summary["activity"])
        assert summary["metrics"]["encounters"] == len(summary["encounters"])
        assert summary["metrics"]["pending"] == sum(
            e["draft_status"] == "PENDING" for e in summary["encounters"]
        )
        assert summary["metrics"]["approved"] == len(summary["decisions"])
    assert TestClient(app).get("/api/workspace").status_code == 401


def test_admin_registers_assigns_and_reassigns_patient(clients):
    doctor_one, doctor_two = clients
    admin = TestClient(app)
    login = admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "ZeestAdmin!2026"},
    )
    assert login.status_code == 200, login.text
    assert login.json()["physician"]["role"] == "admin"
    admin.headers["x-csrf-token"] = login.json()["csrf"]
    workspace = admin.get("/api/admin/workspace").json()
    doctors = {row["email"]: row for row in workspace["physicians"]}
    created = admin.post(
        "/api/admin/patients",
        json={
            "name": "Admin Flow Patient",
            "info": "Synthetic record only. Age 44. Allergy: none documented.",
            "physician_id": doctors["doctor1@example.com"]["id"],
        },
    )
    assert created.status_code == 201, created.text
    patient_id = created.json()["id"]
    consultation = admin.post(
        f"/api/admin/patients/{patient_id}/consultations",
        json={
            "date": "2026-10-21",
            "title": "Initial consultation",
            "laboratory": "HbA1c 5.8%, supplied by administrator",
            "medication": "Metformin 500 mg daily, supplied by administrator",
        },
    )
    assert consultation.status_code == 201, consultation.text
    consultation_id = consultation.json()["id"]
    upload = admin.post(
        f"/api/admin/consultations/{consultation_id}/uploads",
        data={"kind": "laboratory"},
        files={"file": ("lab.png", b"\x89PNG\r\n\x1a\nreport", "image/png")},
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["kind"] == "laboratory"
    source_id = upload.json()["id"]
    physician_view = doctor_one.get(f"/api/encounters/{consultation_id}")
    assert physician_view.status_code == 200, physician_view.text
    assert any(row["id"] == source_id for row in physician_view.json()["inputs"])
    assert any(
        row["kind"] == "laboratory" and row["content"].startswith("HbA1c")
        for row in physician_view.json()["inputs"]
    )
    assert doctor_one.get(f"/api/inputs/{source_id}/file").content.endswith(b"report")
    assert admin.get(f"/api/inputs/{source_id}/file").status_code == 200
    missed = admin.post(
        f"/api/admin/patients/{patient_id}/consultations",
        json={"date": "2020-01-01", "title": "Missed consultation"},
    )
    assert missed.status_code == 201, missed.text
    missed_id = missed.json()["id"]
    summary = doctor_one.get("/api/workspace").json()
    missed_row = next(row for row in summary["encounters"] if row["id"] == missed_id)
    assert missed_row["lifecycle"] == "NOT_ATTENDED"
    assert missed_row["resumable"] is False
    assert any(row["id"] == patient_id for row in doctor_one.get("/api/patients").json())
    assert doctor_two.get(f"/api/patients/{patient_id}").status_code == 404
    updated = admin.put(
        f"/api/admin/patients/{patient_id}",
        json={
            "name": "Admin Flow Patient",
            "info": "Synthetic record only. Reassigned for workflow verification.",
            "physician_id": doctors["doctor2@example.com"]["id"],
        },
    )
    assert updated.status_code == 200, updated.text
    assert doctor_one.get(f"/api/patients/{patient_id}").status_code == 404
    assert doctor_two.get(f"/api/patients/{patient_id}").status_code == 200
    assert doctor_one.get("/api/admin/workspace").status_code == 403
    assert admin.get("/api/patients").status_code == 403



def test_admin_clinical_report_upload_saves_structured_nlp_for_assigned_physician(clients):
    physician, other_physician = clients
    _, encounter_id = context(physician)
    admin = TestClient(app)
    login = admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "ZeestAdmin!2026"},
    )
    assert login.status_code == 200, login.text
    admin.headers["x-csrf-token"] = login.json()["csrf"]
    uploaded = admin.post(
        f"/api/admin/consultations/{encounter_id}/uploads",
        data={"kind": "clinical_report"},
        files={
            "file": (
                "synthetic-clinical-report.txt",
                b"Patient has diabetes. No evidence of pneumonia. Possible asthma.",
                "text/plain",
            )
        },
    )
    assert uploaded.status_code == 201, uploaded.text
    source = uploaded.json()
    assert source["kind"] == "clinical_report"
    saved = __import__("json").loads(source["content"])
    assert saved["research_only"] is True
    assert saved["result"]["findings"]
    mentions = [
        mention
        for finding in saved["result"]["findings"]
        for mention in finding["value"]["mentions"]
    ]
    assert {mention["text"] for mention in mentions} >= {
        "diabetes",
        "pneumonia",
        "asthma",
    }
    assert physician.get(f"/api/encounters/{encounter_id}").json()["inputs"][-1]["id"] == source["id"]
    entered_text = "History of diabetes. No evidence of pneumonia. Possible asthma."
    entered = admin.post(
        f"/api/admin/consultations/{encounter_id}/reports",
        json={"text": entered_text},
    )
    assert entered.status_code == 201, entered.text
    entered_content = __import__("json").loads(entered.json()["content"])
    assert entered_content["source_text"] == entered_text
    assert entered_content["result"]["findings"]
    assert not {"atelectasis", "cardiomegaly", "consolidation", "edema", "pleural_effusion"} & {
        finding["code"] for finding in entered_content["result"]["findings"]
    }
    physician_inputs = physician.get(f"/api/encounters/{encounter_id}").json()["inputs"]
    assert any(row["id"] == entered.json()["id"] for row in physician_inputs)
    assert other_physician.get(f"/api/encounters/{encounter_id}").status_code == 404


def test_complete_consultation_history_is_persisted(clients):
    doctor, _ = clients
    patient_id, consultation_id = context(doctor)
    current = doctor.get(f"/api/encounters/{consultation_id}").json()
    note = doctor.post(
        f"/api/encounters/{consultation_id}/notes",
        json={
            "expected_version": current["encounter"]["version"],
            "transcript": "Persisted consultation transcript",
            "subjective": "Persisted subjective note",
            "objective": "Persisted objective note",
            "assessment": "Persisted physician assessment",
            "plan": "Persisted physician plan",
        },
    )
    assert note.status_code == 200, note.text
    admin = TestClient(app)
    login = admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "ZeestAdmin!2026"},
    )
    admin.headers["x-csrf-token"] = login.json()["csrf"]
    laboratory = admin.post(
        f"/api/admin/consultations/{consultation_id}/uploads",
        data={"kind": "laboratory"},
        files={
            "file": (
                "persisted-lab.txt",
                b"Persisted test 4.2 mmol/L",
                "text/plain",
            )
        },
    )
    assert laboratory.status_code == 201, laboratory.text
    findings_response = doctor.post(
        f"/api/encounters/{consultation_id}/findings",
        json={"scenario": "routine"},
    )
    assert findings_response.status_code == 200, findings_response.text
    draft = generate(doctor, consultation_id)
    patient_name = doctor.get(f"/api/patients/{patient_id}").json()["patient"]["name"]
    assert patient_name in draft["diagnosis"]
    assert "Persisted physician assessment" in draft["diagnosis"]
    assert "Persisted physician plan" in draft["treatment"]
    approved = review(doctor, consultation_id, draft, "APPROVE")
    assert approved.status_code == 200, approved.text
    saved = doctor.get(f"/api/encounters/{consultation_id}").json()
    latest_note = [row for row in saved["inputs"] if row["kind"] == "notes"][-1]
    assert json_content(latest_note)["plan"] == "Persisted physician plan"
    history = doctor.get(f"/api/encounters/{consultation_id}/history").json()
    row = next(item for item in history["history"] if item["encounter_id"] == consultation_id)
    assert row["progress"] == {
        "notes": True,
        "clinical_inputs": True,
        "review": True,
        "decision": True,
    }
    assert any(item["id"] == laboratory.json()["id"] for item in row["sources"])
    assert row["findings"] and row["drafts"] and row["approved_decisions"]
    profile = doctor.get(f"/api/patients/{patient_id}").json()
    consultation = next(item for item in profile["encounters"] if item["id"] == consultation_id)
    assert consultation["note_count"] > 0
    assert consultation["input_count"] > 0
    assert consultation["draft_count"] > 0
    assert consultation["decision_count"] > 0
    assert consultation["lifecycle"] == "COMPLETED"
    assert consultation["resumable"] is False


def test_patient_memory_retrieves_prior_inputs_only_and_enforces_ownership(clients):
    doctor, other_doctor = clients
    patient_id = doctor.get("/api/patients").json()[0]["id"]
    profile = doctor.get(f"/api/patients/{patient_id}").json()
    visits = sorted(profile["encounters"], key=lambda item: (item["date"], item["id"]))
    assert len(visits) >= 2
    earlier, current = visits[0], visits[-1]
    response = doctor.post(
        f"/api/patients/{patient_id}/memory",
        json={"encounter_id": current["id"], "query": "intermittent cough", "top_k": 5, "mode": "keyword"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["indexed_sources"] == 3
    assert body["retrieval_mode"] == "keyword"
    assert body["result"]["findings"]
    assert all(item["value"]["encounter_id"] == str(earlier["id"]) for item in body["result"]["findings"])
    assert all("lexical cosine similarity" == item["value"]["score_type"] for item in body["result"]["findings"])
    assert "not diagnostic probability" in body["result"]["limitations"][0]
    assert other_doctor.post(
        f"/api/patients/{patient_id}/memory",
        json={"encounter_id": current["id"], "query": "cough", "mode": "keyword"},
    ).status_code == 404
    assert doctor.post(
        f"/api/patients/{patient_id}/memory",
        json={"encounter_id": profile["encounters"][-1]["id"] + 99999, "query": "cough", "mode": "keyword"},
    ).status_code == 404



def test_patient_memory_semantic_route_and_keyword_comparison(clients, monkeypatch):
    doctor, _ = clients
    patient_id = doctor.get("/api/patients").json()[0]["id"]
    profile = doctor.get(f"/api/patients/{patient_id}").json()
    visits = sorted(profile["encounters"], key=lambda item: (item["date"], item["id"]))
    earlier, current = visits[0], visits[-1]
    with SessionLocal.begin() as session:
        session.add(Input(
            encounter_id=earlier["id"], kind="notes",
            content='{"subjective":"Wheezing was heard during the earlier visit."}',
        ))

    class FakeScorer:
        name = "synthetic-test-scorer"
        revision = "test"

        def score(self, query, documents):
            assert query == "whistling sound"
            return [0.99 if "wheezing" in text.lower() else 0.05 for text in documents]

    import main
    monkeypatch.setattr(main, "_get_patient_memory_scorer", lambda: FakeScorer())
    response = doctor.post(
        f"/api/patients/{patient_id}/memory",
        json={"encounter_id": current["id"], "query": "whistling sound", "mode": "semantic"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["model"]["name"] == "synthetic-test-scorer"
    assert body["result"]["findings"][0]["value"]["encounter_id"] == str(earlier["id"])
    assert body["result"]["findings"][0]["value"]["score_type"] == "embedding cosine similarity"
    assert body["keyword_baseline"] == []
