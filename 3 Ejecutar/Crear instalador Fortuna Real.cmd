@echo off
chcp 65001 >nul
title Fortuna Real - Crear instalador
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\1 Programa\crear-instalador.ps1" %*
if errorlevel 1 pause
