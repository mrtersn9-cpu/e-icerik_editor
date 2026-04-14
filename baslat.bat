@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi.
  echo Once Node.js kurup tekrar deneyin.
  pause
  exit /b 1
)

if not exist "node_modules\react-scripts\bin\react-scripts.js" (
  echo Bagimliliklar kuruluyor...
  call npm install
  if errorlevel 1 (
    echo npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

if not exist "build\index.html" (
  echo Production build olusturuluyor...
  call npm run build
  if errorlevel 1 (
    echo Build islemi basarisiz oldu.
    pause
    exit /b 1
  )
)

echo Sunucu baslatiliyor: http://localhost:4001
call node server.mjs

endlocal
