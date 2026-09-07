$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it and try again." }

docker compose -f portable-compose.yaml up -d
if ($LASTEXITCODE -ne 0) { throw "DNP AI Radar could not be started." }

Start-Process "http://localhost:3000"
Write-Host "DNP AI Radar is running at http://localhost:3000" -ForegroundColor Green
