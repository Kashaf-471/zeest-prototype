param([switch]$SkipSpeechModel)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
 if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) { python -m venv .venv }
 & ./.venv/Scripts/python.exe -m pip install -r requirements.lock
 if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
 & ./.venv/Scripts/python.exe -m alembic upgrade head
 if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
 & ./.venv/Scripts/python.exe seed.py
 if ($LASTEXITCODE -ne 0) { throw 'Demo seed failed' }
 if (-not $SkipSpeechModel) {
  $env:HF_HUB_DISABLE_XET = '1'
  & ./.venv/Scripts/python.exe speech_setup.py
  if ($LASTEXITCODE -ne 0) { throw 'Local model setup failed. Retry python speech_setup.py when downloads are available.' }
 }
} finally { Pop-Location }
