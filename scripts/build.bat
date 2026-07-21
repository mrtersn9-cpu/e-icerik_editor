@echo off
setlocal

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi.
  echo Once Node.js kurup tekrar deneyin.
  pause
  exit /b 1
)

echo Dagitim paketi hazirlaniyor (build + yedek + FTP paketleme)...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\hazirla-ftp.ps1"
if errorlevel 1 (
  echo Paket hazirlama basarisiz oldu.
  pause
  exit /b 1
)

if not exist "deploy-ftp" (
  echo deploy-ftp klasoru bulunamadi, dist olusturulamadi.
  pause
  exit /b 1
)

if exist "dist" (
  rd /s /q "dist"
)

xcopy "deploy-ftp" "dist" /E /I /Y /Q >nul
if errorlevel 1 (
  echo dist klasoru olusturulamadi.
  pause
  exit /b 1
)

echo.
echo Dagitim paketi hazir: dist\ (sunucuya yuklenebilir)
echo (deploy-ftp\ klasoru de mevcut, dist\ onun bir kopyasidir)

endlocal
