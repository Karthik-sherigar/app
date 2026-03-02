@echo off
echo ===============================================
echo 🚀 Starting AI Knowledge Graph Platform
echo ===============================================

cd backend
if not exist venv\Scripts\activate (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate

echo Checking backend dependencies...
pip install -r requirements.txt

echo.
echo 🔥 Launching Backend Multi-Servers...
start /b uvicorn query_server:app --host 0.0.0.0 --port 8001 --reload > query_server.log 2>&1
start /b uvicorn pdf_server:app --host 0.0.0.0 --port 8002 --reload > pdf_server.log 2>&1
start /b uvicorn programming_server:app --host 0.0.0.0 --port 8003 --reload > programming_server.log 2>&1
start /b uvicorn server:app --host 0.0.0.0 --port 8000 --reload > main_server.log 2>&1

echo ✅ Backend Gateway: http://localhost:8000
echo.

echo 📦 Setting up Frontend...
cd ..\frontend

if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install --legacy-peer-deps
)

echo 🔥 Launching Frontend Dashboard...
start /b npm start

echo.
echo ===============================================
echo ✨ ALL SERVICES STARTED!
echo 🖥️  Frontend:  http://localhost:3000
echo 📡 Backend:   http://localhost:8000
echo 📚 API Docs:  http://localhost:8000/docs
echo ===============================================
echo Logs are being written to backend/*.log files.
echo Press Ctrl+C or close this window to stop everything.
