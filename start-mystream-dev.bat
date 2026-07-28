@echo off
title MyStream Studio - 1-Click Launcher
color 0A
echo ===================================================================
echo        MYSTREAM STUDIO - BROADCAST ENGINE 1-CLICK LAUNCHER
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/3] Menjalankan MediaMTX Streaming Server (Port 1935 RTMP dan Port 8889 WebRTC)...
start "MediaMTX Server" /min C:\mediamtx\mediamtx.exe

echo [2/3] Verifikasi Database SQLite (Prisma)...
call npx prisma db push --skip-generate >nul 2>&1

echo [3/3] Menjalankan Server Web Dashboard (Next.js)...
echo.
echo ===================================================================
echo   DASHBOARD AKAN TERBUKA DI BROWSER: http://localhost:3123
echo   (Jangan tutup jendela command prompt ini selama aplikasi dipakai)
echo ===================================================================
echo.

timeout /t 3 >nul
start http://localhost:3123

set PORT=3123
set NEXTAUTH_URL=https://devrestream.awgverse.site
call npm run dev
