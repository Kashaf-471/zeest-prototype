"""Verify session, source, accepted decision and audit persistence across process restart."""

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "verification"
OUTPUT.mkdir(exist_ok=True)
test_root = ROOT / ".test-data"
test_root.mkdir(exist_ok=True)
env = dict(
    os.environ, ZEEST_DATA_DIR=tempfile.mkdtemp(dir=test_root), HF_HUB_OFFLINE="1"
)
env.pop("DATABASE_URL", None)
for args in (["-m", "alembic", "upgrade", "head"], ["seed.py"]):
    subprocess.run(
        [sys.executable, *args], cwd=ROOT, env=env, check=True, capture_output=True
    )
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]


def start(log):
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        cwd=ROOT,
        env=env,
        stdout=log,
        stderr=log,
    )
    for _ in range(100):
        try:
            if httpx.get(f"http://127.0.0.1:{port}/api/health").status_code == 200:
                return process
        except httpx.HTTPError:
            pass
        if process.poll() is not None:
            raise RuntimeError("Restart verification server failed to start")
        time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Restart verification startup timed out")


def stop(process):
    process.terminate()
    process.wait(timeout=10)


with (OUTPUT / "restart-server.log").open("w") as log:
    process = start(log)
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}/api") as client:
            login = client.post(
                "/auth/login",
                json={"email": "doctor1@example.com", "password": "ZeestDemo!2026"},
            )
            login.raise_for_status()
            client.headers["x-csrf-token"] = login.json()["csrf"]
            patient = client.get("/patients").json()[0]
            encounter = client.get(f"/patients/{patient['id']}").json()["encounters"][
                0
            ]["id"]
            base = f"/encounters/{encounter}"
            version = client.get(base).json()["encounter"]["version"]
            client.post(
                base + "/notes",
                json={
                    "expected_version": version,
                    "transcript": "Persisted restart test note",
                },
            ).raise_for_status()
            upload = client.post(
                base + "/uploads",
                files={
                    "file": ("restart.txt", b"Persisted synthetic upload", "text/plain")
                },
            )
            upload.raise_for_status()
            draft = client.post(base + "/drafts", json={"scenario": "routine"}).json()
            client.post(
                base + "/review", json={"revision_id": draft["id"], "action": "APPROVE"}
            ).raise_for_status()
            before = client.get(base + "/records").json()
            stop(process)
            process = start(log)
            assert client.get("/auth/me").status_code == 200, (
                "Session did not survive restart"
            )
            after = client.get(base + "/records").json()
            assert after == before and len(after["decisions"]) == 1
            assert (
                client.get(f"/inputs/{upload.json()['id']}/file").content
                == b"Persisted synthetic upload"
            )
            assert any(
                "Persisted restart test note" in i["content"]
                for i in client.get(base).json()["inputs"]
            )
            result = {
                "process_restart": "passed",
                "same_session": "passed",
                "notes": "passed",
                "upload": "passed",
                "decisions": len(after["decisions"]),
                "audit_events": len(after["audit"]),
            }
            (OUTPUT / "restart-result.json").write_text(json.dumps(result, indent=2))
            print(json.dumps(result))
    finally:
        if process.poll() is None:
            stop(process)
