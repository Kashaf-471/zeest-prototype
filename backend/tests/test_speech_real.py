"""Opt-in real, offline speech check. Does not monkeypatch inference."""

import io, json, os, time, wave
from pathlib import Path
import pytest


@pytest.mark.skipif(
    os.getenv("ZEEST_REAL_SPEECH") != "1", reason="Opt-in real local model test"
)
def test_real_local_synthetic_speech():
    from speech import transcribe

    fixture = Path(__file__).parent / "fixtures" / "synthetic-speech.wav"
    assert fixture.exists(), "Run ./tests/generate_speech.ps1 first"
    started = time.monotonic()
    transcript = transcribe(fixture)
    elapsed = round(time.monotonic() - started, 2)
    assert "patient reports a cough" in transcript.lower(), transcript
    silence = fixture.parent / "silence.wav"
    with wave.open(str(silence), "wb") as out:
        out.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        out.writeframes(b"\0\0" * 48000)
    assert transcribe(silence) == ""
    result = {
        "fixture": "Windows System.Speech synthetic voice",
        "transcript": transcript,
        "elapsed_seconds": elapsed,
        "silence": "empty transcript",
        "hardware_microphone": "not tested",
    }
    output = Path(__file__).resolve().parents[2] / "verification" / "speech-result.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
