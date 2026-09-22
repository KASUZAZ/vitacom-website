@echo off
cd /d "%~dp0"
echo Vitacom Studio: http://127.0.0.1:8766/admin.html
echo Keep this window open while using the admin.
python admin-server.py
pause
