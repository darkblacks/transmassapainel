@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo.
echo Iniciando frontend TSX...
call npm run dev
pause
