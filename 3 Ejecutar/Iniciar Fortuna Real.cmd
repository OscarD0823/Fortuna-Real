@echo off
chcp 65001 >nul
title Fortuna Real - Iniciador
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\1 Programa\iniciar-fortuna.ps1" %*
if errorlevel 1 pause
