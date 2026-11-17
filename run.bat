@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo [KosHunt] Installing npm workspace dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist "client\dist\index.html" (
  echo [KosHunt] Building frontend bundle...
  call npm run build
  if errorlevel 1 exit /b 1
)

if "%PORT%"=="" set PORT=3001
if "%HOST%"=="" set HOST=127.0.0.1
echo [KosHunt] Starting Bento Studio at http://%HOST%:%PORT%
call npm run start

