#!/bin/bash

# AI Knowledge Graph Platform - Unified Startup Script
# This script works on Windows (Git Bash/WSL) and Linux/Mac.

# Function to kill child processes on exit
trap 'kill $(jobs -p) 2>/dev/null' SIGINT SIGTERM EXIT

echo "==============================================="
echo "🚀 Starting AI Knowledge Graph Platform"
echo "==============================================="

# Detect OS for environment paths
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    ACTIVATE="./venv/Scripts/activate"
    PYTHON_CMD="python"
else
    ACTIVATE="./venv/bin/activate"
    PYTHON_CMD="python3"
fi

# 1. Setup & Start Backend
echo "📦 Setting up Backend..."
cd backend || exit

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

source "$ACTIVATE"
echo "Checking backend dependencies..."
pip install -r requirements.txt

echo "🔥 Launching Unified Backend Server..."
# We run these in background with logs directed to file to keep console clean
uvicorn server:app --host 0.0.0.0 --port 8015 > main_server.log 2>&1 &

echo "✅ Backend Server: http://localhost:8015"

# 2. Setup & Start Frontend
echo "� Setting up Frontend..."
cd ../frontend || exit

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (legacy-peer-deps for React 19)..."
    npm install --legacy-peer-deps
fi

echo "🔥 Launching Frontend Dashboard..."
# Running frontend in background
npm start &

echo "==============================================="
echo "✨ ALL SERVICES STARTED!"
echo "🖥️  Frontend:  http://localhost:3000"
echo "📡 Backend:   http://localhost:8015"
echo "📚 API Docs:  http://localhost:8015/docs"
echo "==============================================="
echo "Logs are being written to backend/*.log files."
echo "Press Ctrl+C to stop everything."

# Wait for background processes
wait
