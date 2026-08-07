@echo off
title QLNV - Viettel Software Management System
echo ===================================================
echo   VIETTEL SOFTWARE - QUAN LY NHAN SU ^& THUC TAP SINH
echo ===================================================
echo.

set "PROJECT_DIR=%~dp0"

:: Auto-create Desktop Shortcut if missing
if exist "%PROJECT_DIR%create_shortcut.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%create_shortcut.ps1" >nul 2>&1
)

:: Free port 8000 if occupied
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [1/3] Checking Node.js ^& Building React Frontend...
if not exist "%PROJECT_DIR%frontend\dist" (
    echo [INFO] Building React Frontend for the first time...
    cd /d "%PROJECT_DIR%frontend"
    call npm run build
    cd /d "%PROJECT_DIR%"
) else (
    echo [OK] React Frontend build found.
)

echo [2/3] Checking Python environment...
set PYTHON_CMD=py -3.12
%PYTHON_CMD% --version >nul 2>&1
if errorlevel 1 (
    set PYTHON_CMD=python
)

%PYTHON_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    pause & exit /b 1
)

echo [3/3] Checking Backend Python dependencies...
cd /d "%PROJECT_DIR%backend"
%PYTHON_CMD% -m pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing required backend packages...
    %PYTHON_CMD% -m pip install -r requirements.txt
)

echo.
echo ===================================================
echo  [OK] Server starting at http://localhost:8000
echo  [OK] Default account: admin / Admin@123
echo ===================================================
echo.
echo [NOTE] Tat cua so Terminal nay se tat toan bo chuong trinh!
echo.

:: Automatically open browser to the React App
start http://localhost:8000

:: Start FastAPI Backend App
%PYTHON_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
