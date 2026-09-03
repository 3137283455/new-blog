param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend-astro"
$env:ASTRO_TELEMETRY_DISABLED = "1"

Write-Host "[boke] stopping old project node processes..."
$procs = @()
try {
  $procs = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
    Where-Object {
      $_.CommandLine -like "*$backend*" -or
      $_.CommandLine -like "*$frontend*" -or
      $_.CommandLine -like "*dist/server/entry.mjs*"
    }
} catch {
  Write-Warning "[boke] cannot inspect existing node processes; skipping cleanup."
}
foreach ($proc in $procs) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Host "  stopped or released node pid $($proc.ProcessId)"
}

if (-not $SkipBuild) {
  Write-Host "[boke] building backend..."
  Push-Location $backend
  npm.cmd run build
  Pop-Location

  Write-Host "[boke] building frontend..."
  Push-Location $frontend
  npm.cmd run build
  Pop-Location
}

Write-Host "[boke] starting backend on 3001..."
Start-Process powershell -WindowStyle Hidden -WorkingDirectory $backend -ArgumentList "-NoExit", "-Command", "npm.cmd run start"

Write-Host "[boke] starting frontend on 3000..."
Start-Process powershell -WindowStyle Hidden -WorkingDirectory $frontend -ArgumentList "-NoExit", "-Command", "`$env:PORT='3000'; `$env:HOST='127.0.0.1'; npm.cmd run start"

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:3001"
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Admin:    http://127.0.0.1:3000/admin"
