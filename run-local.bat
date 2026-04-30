@echo off
cd /d "%~dp0"
echo Starting local server at http://127.0.0.1:5173/
start "" "http://127.0.0.1:5173/"
py -3 -m http.server 5173 --bind 127.0.0.1
if errorlevel 1 python -m http.server 5173 --bind 127.0.0.1
