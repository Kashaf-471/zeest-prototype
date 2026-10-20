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


def test_upload_and_unknown_mapping_and_csrf(clients):
    a, b = clients
    p, e = context(a)
    assert (
        a.post(
            f"/api/encounters/{e}/uploads", files={"file": ("bad.exe", b"bad")}
        ).status_code
        == 422
    )
    assert (
        a.post(
            f"/api/encounters/{e}/uploads", files={"file": ("fake.png", b"not png")}
        ).status_code
        == 422
    )
    r = a.post(
        f"/api/encounters/{e}/uploads",
        files={"file": ("unknown.txt", b"Arbitrary test input", "text/plain")},
    )
    assert r.status_code == 200
    result = a.post(
        f"/api/encounters/{e}/findings", json={"scenario": "routine"}
    ).json()
    assert (
        next(f for f in result["findings"] if f["input_id"] == r.json()["id"])[
            "finding"
        ]
        == "No simulated analysis mapped to this input"
    )
    assert (
        a.post(
            f"/api/encounters/{e}/inputs", json={"kind": "laboratory", "content": "  "}
        ).status_code
        == 422
    )
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
