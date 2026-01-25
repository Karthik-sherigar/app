#!/bin/bash

# Function to kill child processes on exit
trap 'kill $(jobs -p)' SIGINT SIGTERM EXIT

echo "Starting AI Knowledge Graph Platform..."

# Start Backend
echo "🚀 Starting Backend (Port 8000)..."
cd backend || exit

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Detect OS for activation
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "Installing/Updating backend dependencies..."
pip install -r requirements.txt

# Run backend in background
uvicorn server:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start Frontend
echo "🚀 Starting Frontend (Port 3000)..."
cd ../frontend || exit
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Run frontend
npm start &
FRONTEND_PID=$!

echo "✅ Services started!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop all services."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
