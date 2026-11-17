$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not (Test-Path "node_modules")) {
  Write-Host "[KosHunt] Installing npm workspace dependencies..." -ForegroundColor Cyan
  npm install
}

if (-not (Test-Path (Join-Path "client" (Join-Path "dist" "index.html")))) {
  Write-Host "[KosHunt] Building frontend bundle..." -ForegroundColor Cyan
  npm run build
}

if (-not $env:PORT) { $env:PORT = "3001" }
if (-not $env:HOST) { $env:HOST = "127.0.0.1" }
Write-Host "[KosHunt] Starting Bento Studio at http://$($env:HOST):$($env:PORT)" -ForegroundColor Green
npm run start

