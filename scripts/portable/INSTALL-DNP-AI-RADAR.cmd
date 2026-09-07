@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-DNP-Ai-Radar.ps1"
if errorlevel 1 pause
