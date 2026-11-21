$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$Root\backend'; php artisan serve --host=127.0.0.1 --port=8000"
)

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$Root\ml-service'; if (Test-Path '.\.venv\Scripts\python.exe') { & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8001 } else { python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 }"
)

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$Root\frontend'; npm run dev -- --host 127.0.0.1"
)

Write-Host "Sava development services started:"
Write-Host "  Laravel: http://127.0.0.1:8000"
Write-Host "  FastAPI: http://127.0.0.1:8001"
Write-Host "  Vite:    http://127.0.0.1:5173"
