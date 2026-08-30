@echo off
setlocal
title Fortuna Real - Descarga de respaldo
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-desde-github.ps1"
set "FORTUNA_EXIT=%ERRORLEVEL%"
if not "%FORTUNA_EXIT%"=="0" (
  echo.
  echo La instalacion no termino correctamente. Revisa el mensaje anterior.
  pause
)
exit /b %FORTUNA_EXIT%
