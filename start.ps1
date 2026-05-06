# Start AI Knowledge Graph Platform

Write-Host "Starting AI Knowledge Graph Platform..." -ForegroundColor Cyan

# Check for Neo4j (Optional Warning)
$Neo4jPort = 7687
$Neo4jRunning = (Test-NetConnection -ComputerName localhost -Port $Neo4jPort -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $Neo4jRunning) {
    Write-Host "⚠️ Warning: Neo4j does not appear to be running on port $Neo4jPort." -ForegroundColor Yellow
    Write-Host "The backend may fail to start unless Neo4j is running locally or a cloud URL is configured in backend/.env" -ForegroundColor Yellow
}

# Get the absolute root path
$RootPath = (Get-Item -Path ".\").FullName
$BackendPath = Join-Path $RootPath "backend"
$FrontendPath = Join-Path $RootPath "frontend"

# --- Backend Setup ---
Write-Host "🚀 Preparing Backend (Port 8000)..." -ForegroundColor Green
Set-Location -Path $BackendPath

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

# Activate venv and check dependencies
.\venv\Scripts\Activate.ps1
Write-Host "Checking backend dependencies..."
pip install -r requirements.txt

# Start uvicorn unified server in a NEW window
Write-Host "🚀 Starting Unified Backend Server (8015)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command Set-Location -LiteralPath '$BackendPath'; .\venv\Scripts\Activate.ps1; uvicorn server:app --reload --host 0.0.0.0 --port 8015"

# Wait for backend services to initialize
Start-Sleep -Seconds 5

# --- Frontend Setup ---
Write-Host "🚀 Preparing Frontend (Port 3000)..." -ForegroundColor Green
Set-Location -Path $FrontendPath

# Force install with legacy-peer-deps to fix React 19 dependency conflicts (craco/etc)
if (-not (Test-Path "node_modules") -or -not (Test-Path "node_modules\.bin\craco.ps1")) {
    Write-Host "Installing frontend dependencies (using --legacy-peer-deps for React 19 compatibility)..." -ForegroundColor Cyan
    npm install --legacy-peer-deps
}

# Start npm in a NEW window
Start-Process powershell -ArgumentList "-NoExit -Command Set-Location -LiteralPath '$FrontendPath'; npm start"

# Return to root
Set-Location -Path $RootPath

Write-Host ""
Write-Host "✅ Services started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:8015"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Please check the individual terminal windows for logs."
