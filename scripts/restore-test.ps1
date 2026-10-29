param([Parameter(Mandatory)][string]$BackupFile, [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin', [int]$Port=55432)
$ErrorActionPreference = 'Stop'
$taskBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$taskDatabase = 'trolley_restore_' + [Guid]::NewGuid().ToString('N') + '_test'
$taskPreviousSslMode=$env:PGSSLMODE
try {
$env:PGSSLMODE = 'disable'
# This creates a new database on the task's disposable test server. It never cleans/replaces an existing database.
& (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $Port -U trolley_test $taskDatabase
if ($LASTEXITCODE -ne 0) { throw 'Cannot create a fresh restore-test database.' }
& (Join-Path $PostgresBin 'pg_restore.exe') -h 127.0.0.1 -p $Port -U trolley_test --dbname=$taskDatabase --no-owner --exit-on-error $taskBackup
if ($LASTEXITCODE -ne 0) { throw "Restore failed. Inspect $taskDatabase; original database was untouched." }
& (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $Port -U trolley_test --dbname=$taskDatabase -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS documents FROM document; SELECT account,sum(amount) AS minor_units FROM journal_line GROUP BY account ORDER BY account; SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0;'
if ($LASTEXITCODE -ne 0) { throw 'Restore verification failed.' }
Write-Output "Restored to a fresh test database: $taskDatabase. Compare expected source balances before treating the backup as verified."

} finally {
  if ([string]::IsNullOrEmpty($taskPreviousSslMode)) { Remove-Item -LiteralPath Env:PGSSLMODE -ErrorAction SilentlyContinue }
  else { $env:PGSSLMODE=$taskPreviousSslMode }
}
