@echo off
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\1 Programa\iniciar-canicas-nativo.ps1"
if errorlevel 1 pause
