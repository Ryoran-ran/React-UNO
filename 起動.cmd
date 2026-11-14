@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist ".tools\node.exe" (
  ".tools\node.exe" scripts\run.mjs dev
) else (
  node scripts\run.mjs dev
)
pause
