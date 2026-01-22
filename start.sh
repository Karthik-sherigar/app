#!/bin/bash

# Function to kill child processes on exit
trap 'kill $(jobs -p)' SIGINT SIGTERM EXIT

echo "Starting AI Knowledge Graph Platform..."

# Start Backend
# Start Neo4j (Local)
if [ -d "neo4j_local" ]; then
    echo "Starting Neo4j locally..."
    ./neo4j_local/bin/neo4j start || echo "Neo4j already running or failed to start"
else
    echo "Neo4j local directory not found. Please install Neo4j."
fi

echo "🚀 Starting Backend (Port 8000)..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Installing/Updating backend dependencies..."
pip install -r requirements.txt

# Run backend in background
uvicorn server:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready (optional check)
sleep 2

# Start Frontend
echo "🚀 Starting Frontend (Port 3000)..."
cd ../frontend
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
