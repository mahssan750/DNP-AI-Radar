$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
docker compose -f portable-compose.yaml down
if ($LASTEXITCODE -ne 0) { throw "DNP AI Radar could not be stopped cleanly." }
Write-Host "DNP AI Radar is stopped. Your data is still saved." -ForegroundColor Green
