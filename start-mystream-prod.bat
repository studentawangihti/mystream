@echo off
title MyStream Studio (Production) - 1-Click Launcher
color 0E
echo ===================================================================
echo    MYSTREAM STUDIO (PRODUCTION) - BROADCAST ENGINE 1-CLICK LAUNCHER
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/4] Menjalankan MediaMTX Streaming Server (Port 1935 RTMP dan Port 8889 WebRTC)...
start "MediaMTX Server" /min C:\mediamtx\mediamtx.exe

echo [2/4] Verifikasi Database SQLite (Prisma)...
call npx prisma db push --skip-generate >nul 2>&1

echo [3/4] Melakukan Build Dashboard Web (Next.js)...
echo (Proses ini mungkin memakan waktu beberapa detik...)
call npm run build

echo [4/4] Menjalankan Server Web Dashboard Mode Production (Next.js)...
echo.
echo ===================================================================
echo   DASHBOARD AKAN TERBUKA DI BROWSER: http://localhost:3124
echo   (Jangan tutup jendela command prompt ini selama aplikasi dipakai)
echo ===================================================================
echo.

timeout /t 3 >nul
start http://localhost:3124

set PORT=3124
call npm run start
