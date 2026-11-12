"""Run the local app with installed Report NLP and Patient Memory model runtimes."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# Keep the application's pinned backend dependencies available while Python's
# own site-packages provide the installed PyTorch and Transformers runtime.
VENV_SITE = ROOT / ".venv" / "Lib" / "site-packages"
if VENV_SITE.is_dir():
    sys.path.append(str(VENV_SITE))

try:
    import torch  # noqa: F401
    import transformers  # noqa: F401
    import sentence_transformers  # noqa: F401
except ImportError as exc:
    raise SystemExit(
        "The system Python must have PyTorch, Transformers, and Sentence Transformers "
        "installed to run the local Report NLP and Patient Memory models. "
        "Use the normal start.ps1 for non-model workflows."
    ) from exc

MODULE_ROOT = ROOT.parents[2] / "zeest_FYP" / "Fyp-Zeest"
if not (MODULE_ROOT / "models" / "report_ner" / "config.json").is_file():
    raise SystemExit(f"The local Report NLP checkpoint was not found at {MODULE_ROOT}.")
os.environ.setdefault("ZEEST_REPORT_MODULE_ROOT", str(MODULE_ROOT))

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000)
args = parser.parse_args()

from alembic import command
from alembic.config import Config

config = Config(str(ROOT / "alembic.ini"))
config.set_main_option("script_location", str(ROOT / "migrations"))
command.upgrade(config, "head")

from seed import seed

seed()

import uvicorn

uvicorn.run("main:app", host="127.0.0.1", port=args.port)
