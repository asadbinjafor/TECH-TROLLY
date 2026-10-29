param([string]$Destination = (Join-Path $PSScriptRoot '../.local/backups'), [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) { throw 'Set server-only DATABASE_URL for the database to back up.' }
$taskUri = [Uri]$env:DATABASE_URL
$taskIdentity = $taskUri.UserInfo.Split(':', 2)
$taskSavedEnv = @{}
foreach ($taskName in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')) { $taskSavedEnv[$taskName] = [Environment]::GetEnvironmentVariable($taskName) }
try {
  $env:PGHOST = $taskUri.Host
  $env:PGPORT = if ($taskUri.Port -gt 0) { [string]$taskUri.Port } else { '5432' }
  $env:PGUSER = [Uri]::UnescapeDataString($taskIdentity[0])
  $env:PGPASSWORD = if ($taskIdentity.Length -gt 1) { [Uri]::UnescapeDataString($taskIdentity[1]) } else { '' }
  $env:PGDATABASE = $taskUri.AbsolutePath.TrimStart('/')
  $env:PGSSLMODE = if ($env:DATABASE_SSL -eq 'true') { 'verify-full' } else { 'prefer' }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  $taskFile = Join-Path ([IO.Path]::GetFullPath($Destination)) ('tech-trolley-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
  & (Join-Path $PostgresBin 'pg_dump.exe') --format=custom --no-owner --file=$taskFile
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed; do not treat this file as a valid backup.' }
  Get-FileHash -LiteralPath $taskFile -Algorithm SHA256 | Select-Object Path,Hash
} finally {
  foreach ($taskName in $taskSavedEnv.Keys) {
    if ([string]::IsNullOrEmpty($taskSavedEnv[$taskName])) { Remove-Item -LiteralPath ('Env:'+$taskName) -ErrorAction SilentlyContinue }
    else { [Environment]::SetEnvironmentVariable($taskName,$taskSavedEnv[$taskName]) }
  }
}
