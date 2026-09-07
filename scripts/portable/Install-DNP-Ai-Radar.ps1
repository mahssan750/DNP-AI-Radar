param(
    [string]$InstallDirectory = (Join-Path $env:USERPROFILE "DNP-Ai-Radar")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$cryptoScript = Join-Path $PSScriptRoot "PortableCrypto.ps1"
$bundlePath = Join-Path $PSScriptRoot "payload.dnp"
if (-not (Test-Path -LiteralPath $cryptoScript)) { throw "PortableCrypto.ps1 must be beside this installer." }
if (-not (Test-Path -LiteralPath $bundlePath)) { throw "payload.dnp must be beside this installer." }
. $cryptoScript

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is required. Install it from https://www.docker.com/products/docker-desktop/"
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it and run this installer again." }

if (Test-Path -LiteralPath $InstallDirectory) {
    $existing = Get-ChildItem -LiteralPath $InstallDirectory -Force -ErrorAction SilentlyContinue
    if ($existing) { throw "The install folder is not empty: $InstallDirectory" }
}
else {
    New-Item -ItemType Directory -Path $InstallDirectory | Out-Null
}

$password = Read-Host "Transfer password" -AsSecureString
$temporaryZip = Join-Path ([IO.Path]::GetTempPath()) ("dnp-portable-{0}.zip" -f [guid]::NewGuid())
try {
    Write-Host "Decrypting the portable copy..." -ForegroundColor Cyan
    Unprotect-PortableFile -InputPath $bundlePath -OutputPath $temporaryZip -Password $password
    Expand-Archive -LiteralPath $temporaryZip -DestinationPath $InstallDirectory
}
catch {
    if (-not (Get-ChildItem -LiteralPath $InstallDirectory -Force -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $InstallDirectory -Force -ErrorAction SilentlyContinue
    }
    throw
}
finally {
    Remove-Item -LiteralPath $temporaryZip -Force -ErrorAction SilentlyContinue
}

Set-Location $InstallDirectory
Write-Host "Starting the private database..." -ForegroundColor Cyan
docker compose -f portable-compose.yaml up -d postgres
if ($LASTEXITCODE -ne 0) { throw "The database container could not be started." }

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    docker compose -f portable-compose.yaml exec -T postgres pg_isready -U postgres -d dnp_ai_radar *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw "The database did not become ready." }

$containerId = docker compose -f portable-compose.yaml ps -q postgres
if (-not $containerId) { throw "The database container could not be found." }
docker cp (Join-Path $InstallDirectory "portable-data.dump") "${containerId}:/tmp/portable-data.dump"
if ($LASTEXITCODE -ne 0) { throw "The saved data could not be copied into the database." }
docker compose -f portable-compose.yaml exec -T postgres pg_restore --username postgres --dbname dnp_ai_radar --no-owner --no-acl /tmp/portable-data.dump
if ($LASTEXITCODE -ne 0) { throw "The saved data could not be restored." }
docker compose -f portable-compose.yaml exec -T postgres rm -f /tmp/portable-data.dump
Remove-Item -LiteralPath (Join-Path $InstallDirectory "portable-data.dump") -Force

Write-Host "Building and starting DNP AI Radar. The first run can take several minutes..." -ForegroundColor Cyan
docker compose -f portable-compose.yaml up --build -d
if ($LASTEXITCODE -ne 0) { throw "The application could not be built or started." }

Write-Host "" 
Write-Host "Installation complete: $InstallDirectory" -ForegroundColor Green
Write-Host "Open http://localhost:3000 and sign in with your existing account." -ForegroundColor Green
Start-Process "http://localhost:3000"
