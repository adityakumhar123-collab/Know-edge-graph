# AegisGraph AI — One-command launcher
# Starts both the FastAPI backend and Vite frontend.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ── Environment ───────────────────────────────────────────────────────────────
$env:VECTOR_BACKEND    = 'local'
$env:AUTH_MODE         = 'demo'
$env:APP_ENV           = 'development'
$env:RENDER            = 'false'
$env:NEO4J_URI         = ''
$env:CHROMA_MIRROR_ENABLED  = 'false'
$env:LOCAL_DATABASE_PATH    = Join-Path $PSScriptRoot 'data/aegis-local.sqlite3'
$env:UPLOAD_DIR        = Join-Path $PSScriptRoot 'data/uploads'
$env:OPERATIONS_DIR    = Join-Path $PSScriptRoot 'data/local-operations'
$env:SERVE_FRONTEND    = 'false'    # Frontend is served by Vite dev server
$env:HOST              = '127.0.0.1'
$env:PORT              = '8000'
$env:GEMMA_MODEL       = 'gemma4:e4b'

# ── Resolve Python ────────────────────────────────────────────────────────────
$pythonExe = $null
$venvPy = Join-Path $PSScriptRoot 'Phase4/.venv/Scripts/python.exe'
if (Test-Path -LiteralPath $venvPy) {
    $pythonExe = $venvPy
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
    $pythonArgs = @("-3.11")
} else {
    $pythonExe = "python"
    $pythonArgs = @()
}

# ── Launch backend in background ──────────────────────────────────────────────
Write-Host "▶ Starting AegisGraph backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    param($exe, $args, $cwd)
    Set-Location $cwd
    & $exe @args run_app.py
} -ArgumentList $pythonExe, $pythonArgs, $PSScriptRoot

# ── Launch frontend dev server ────────────────────────────────────────────────
Write-Host "▶ Starting Vite dev server on http://localhost:5173 ..." -ForegroundColor Cyan
$frontendDir = Join-Path $PSScriptRoot 'Phase4\frontend'
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:VITE_API_URL = 'http://127.0.0.1:8000'
    npm run dev
} -ArgumentList $frontendDir

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  AegisGraph AI is starting up..." -ForegroundColor White
Write-Host ""
Write-Host "  Backend  → http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "  Frontend → http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "  For live Gemma 4 AI (one-time setup):" -ForegroundColor Yellow
Write-Host "    ollama run gemma4:e4b" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

# Wait 3 seconds then open browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

# Stream logs from both jobs
try {
    while ($true) {
        Receive-Job $backendJob, $frontendJob | Write-Host
        Start-Sleep -Milliseconds 500
    }
} finally {
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob -Force
    Write-Host "Servers stopped." -ForegroundColor Red
}
