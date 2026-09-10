@echo off
cd /d "%~dp0"
echo Limpando cache do Vite...
if exist node_modules\.vite rmdir /s /q node_modules\.vite
echo.
echo Iniciando frontend...
call npm run dev -- --force
pause
