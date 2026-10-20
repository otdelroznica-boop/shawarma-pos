@echo off
chcp 65001 > nul
title Shawarma POS
cd /d "%~dp0"

echo ==============================================
echo   Shawarma POS: запуск
echo ==============================================
echo.

echo [1/3] Обновляю структуру базы данных...
pushd backend
call npx prisma migrate deploy > nul 2>&1
if errorlevel 1 (
  echo    Не удалось подключиться к PostgreSQL. Проверьте, что служба запущена,
  echo    и строку DATABASE_URL в backend\.env
  popd
  pause
  exit /b 1
)
popd

echo [2/3] Запускаю сервер и интерфейс...
start "Shawarma POS - Backend" /D "%~dp0backend" /min cmd /k npm run dev
start "Shawarma POS - Frontend" /D "%~dp0frontend" /min cmd /k npm run dev

echo [3/3] Жду готовности сервера...
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:4000/api/health -TimeoutSec 2) > $null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto ready
if %tries% geq 30 goto ready
timeout /t 1 > nul
goto wait

:ready
start http://localhost:5173
echo.
echo Готово. Касса: http://localhost:5173
echo Табло для гостей: http://localhost:5173/#board
echo Окна серверов свёрнуты, не закрывайте их во время работы.
timeout /t 5 > nul
exit
