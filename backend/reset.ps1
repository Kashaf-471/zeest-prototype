param([switch]$ConfirmReset)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmReset) { throw 'Explicit reset required: ./reset.ps1 -ConfirmReset. This removes local records and uploaded files.' }
if ($env:DATABASE_URL -or $env:ZEEST_DATA_DIR) { throw 'Reset supports only the default local database. Unset custom database/data options first.' }
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'data'))
$expected = [IO.Path]::GetFullPath($PSScriptRoot) + [IO.Path]::DirectorySeparatorChar
if (-not $target.StartsWith($expected)) { throw 'Unsafe reset target' }
foreach ($name in @('zeest.db','zeest.db-wal','zeest.db-shm','uploads')) {
 $item = Join-Path $target $name
 if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Recurse -Force }
}
Push-Location $PSScriptRoot
try {
 & ./.venv/Scripts/python.exe -m alembic upgrade head
 if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
 & ./.venv/Scripts/python.exe seed.py
 if ($LASTEXITCODE -ne 0) { throw 'Demo seed failed' }
} finally { Pop-Location }
