@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-DNP-Ai-Radar.ps1"
if errorlevel 1 pause
