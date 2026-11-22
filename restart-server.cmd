@echo off
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0restart-server.ps1"
set "restartExitCode=%ERRORLEVEL%"
if not "%restartExitCode%"=="0" pause
exit /b %restartExitCode%
