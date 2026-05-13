@echo off
title Xolox Meet

echo Starting Xolox Meet server...
start "Xolox Meet Server" cmd /k "cd /d C:\Users\shaik\Downloads\xolox-meet-updated\xolox-meet\xolox-meet && node server.js"

timeout /t 2 /nobreak > nul

echo Starting ngrok tunnel...
start "Ngrok Tunnel" cmd /k "ngrok http 3000"

timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:3000

echo.
echo Both windows are running!
echo Share the https:// link from the ngrok window with your friend.
