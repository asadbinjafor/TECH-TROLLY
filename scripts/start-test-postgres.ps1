param([string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskData=Join-Path $taskRoot '.local/postgres-test'
New-Item -ItemType Directory -Path (Join-Path $taskRoot '.local') -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) {
 & (Join-Path $PostgresBin 'initdb.exe') -D $taskData -U trolley_test -A trust --encoding=UTF8 --locale=C
 if ($LASTEXITCODE -ne 0) { throw 'Isolated initdb failed.' }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $taskData status
if ($LASTEXITCODE -ne 0) {
 & (Join-Path $PostgresBin 'pg_ctl.exe') -D $taskData -l (Join-Path $taskRoot '.local/postgres-test.log') -o '-p 55432 -h 127.0.0.1' start
 if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL startup failed.' }
}
& (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p 55432 -U trolley_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='trolley_test'" | Tee-Object -Variable taskExists | Out-Null
if (-not $taskExists) { & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U trolley_test trolley_test }
Write-Output 'Test-only PostgreSQL listens on loopback port 55432. Do not use its trust authentication for production.'
