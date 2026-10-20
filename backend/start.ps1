param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
 & ./.venv/Scripts/python.exe -m alembic upgrade head
 if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
 & ./.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port $Port
} finally { Pop-Location }
