@echo off
setlocal

cd /d "%~dp0"

if exist "src\components\FleetAnalytics.tsx" del /f /q "src\components\FleetAnalytics.tsx"
if exist "src\components\CouplingPage.tsx" del /f /q "src\components\CouplingPage.tsx"
if exist "src\components\ServiceOrderHistoryPage.tsx" del /f /q "src\components\ServiceOrderHistoryPage.tsx"

echo Instalando dependencias...
call npm install
if errorlevel 1 (
  echo.
  echo Erro ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Gerando build...
call npm run build
if errorlevel 1 (
  echo.
  echo Erro ao gerar build.
  pause
  exit /b 1
)

echo.
echo Abrindo painel...
start "" "http://localhost:5173"

echo.
echo Iniciando frontend...
call npm run dev

pause
