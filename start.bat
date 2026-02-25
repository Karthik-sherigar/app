@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo 🚀 Starting AI Knowledge Graph Platform (Windows)
echo ===============================================

:: --- Backend Setup ---
echo 📦 Preparing Backend...
cd backend

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating environment and checking dependencies...
call venv\Scripts\activate
pip install -r requirements.txt

echo 🔥 Launching Backend Services in background...
:: Start each server in its own hidden background process via START /B
start /b cmd /c "venv\Scripts\python -m uvicorn query_server:app --port 8001 > query_server.log 2>&1"
start /b cmd /c "venv\Scripts\python -m uvicorn pdf_server:app --port 8002 > pdf_server.log 2>&1"
start /b cmd /c "venv\Scripts\python -m uvicorn programming_server:app --port 8003 > programming_server.log 2>&1"
start /b cmd /c "venv\Scripts\python -m uvicorn server:app --port 8000 > main_server.log 2>&1"

:: --- Frontend Setup ---
echo 📦 Preparing Frontend...
cd ..\frontend

if not exist node_modules (
    echo Installing frontend dependencies...
    npm install --legacy-peer-deps
)

echo 🔥 Launching Frontend...
echo ===============================================
echo ✨ ALL SERVICES STARTED!
echo 🖥️  Frontend:  http://localhost:3000
echo 📡 Backend:   http://localhost:8000
echo ===============================================
echo Press Ctrl+C in this window or close it to stop.

npm start
