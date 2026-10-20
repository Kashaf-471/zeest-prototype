from pathlib import Path
import os, threading, time
from sqlalchemy import select
from db import SessionLocal, Job, Input, DATA

_model = None
_lock = threading.Lock()
MODEL = os.getenv("WHISPER_MODEL", "tiny.en")
CACHE = DATA / "models"


def model(download=False):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            MODEL,
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
            download_root=str(CACHE),
            local_files_only=not download,
            cpu_threads=int(os.getenv("WHISPER_THREADS", "4")),
        )
    return _model


def transcribe(path):
    with _lock:
        segments, info = model().transcribe(
            str(path),
            beam_size=3,
            vad_filter=True,
            condition_on_previous_text=False,
            language=os.getenv("WHISPER_LANGUAGE", "en"),
        )
        return " ".join(x.text.strip() for x in segments).strip()


def run_job(job_id):
    start = time.monotonic()
    with SessionLocal.begin() as s:
        job = s.get(Job, job_id)
        job.status = "PROCESSING"
        path = DATA / "uploads" / s.get(Input, job.input_id).file
    try:
        result = transcribe(path)
        with SessionLocal.begin() as s:
            j = s.get(Job, job_id)
            j.transcript = result
            j.status = "COMPLETED" if result else "SILENCE"
            j.elapsed = round((time.monotonic() - start) * 1000)
    except Exception as exc:
        with SessionLocal.begin() as s:
            j = s.get(Job, job_id)
            j.status = "FAILED"
            j.error = f"Local speech recognition failed ({type(exc).__name__}). Check audio decoding and run python speech_setup.py to cache model weights. Details: {str(exc)[:250]}"
            j.elapsed = round((time.monotonic() - start) * 1000)
