param(
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "portable-output")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cryptoScript = Join-Path $PSScriptRoot "PortableCrypto.ps1"
. $cryptoScript

function Read-EnvFile {
    param([Parameter(Mandatory)][string]$Path)
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function Set-EnvValue {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )
    $content = Get-Content -LiteralPath $Path -Raw
    $line = "$Name=$Value"
    if ($content -match "(?m)^$([regex]::Escape($Name))=") {
        $content = [regex]::Replace(
            $content,
            "(?m)^$([regex]::Escape($Name))=.*$",
            [Text.RegularExpressions.MatchEvaluator]{ param($match) $line }
        )
    }
    else {
        $content = $content.TrimEnd("`r", "`n") + "`r`n$line`r`n"
    }
    [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

$rootEnvPath = Join-Path $repoRoot ".env"
$webEnvPath = Join-Path $repoRoot "apps\web\.env"
if (-not (Test-Path -LiteralPath $rootEnvPath) -or -not (Test-Path -LiteralPath $webEnvPath)) {
    throw "Both .env and apps\web\.env are required."
}

$envValues = Read-EnvFile $rootEnvPath
if (-not $envValues.ContainsKey("DATABASE_URL")) { throw "DATABASE_URL is missing from .env." }
$databaseUri = [Uri]$envValues.DATABASE_URL
$userParts = $databaseUri.UserInfo.Split(':', 2)
$databaseUser = [Uri]::UnescapeDataString($userParts[0])
$databasePassword = if ($userParts.Count -gt 1) { [Uri]::UnescapeDataString($userParts[1]) } else { "" }
$databaseName = $databaseUri.AbsolutePath.TrimStart('/')
$databasePort = if ($databaseUri.Port -gt 0) { $databaseUri.Port } else { 5432 }

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+$' } |
    Sort-Object { [int]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\pg_dump.exe" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
if (-not $pgDump) {
    $command = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($command) { $pgDump = $command.Source }
}
if (-not $pgDump) { throw "PostgreSQL pg_dump was not found on this computer." }

$password = Read-Host "Choose a transfer password (keep it separate from the bundle)" -AsSecureString
$confirmPassword = Read-Host "Enter the transfer password again" -AsSecureString
$passwordText = ConvertFrom-PortableSecureString $password
$confirmText = ConvertFrom-PortableSecureString $confirmPassword
try {
    if ($passwordText.Length -lt 12) { throw "Use a transfer password of at least 12 characters." }
    if ($passwordText -cne $confirmText) { throw "The transfer passwords do not match." }
}
finally {
    $passwordText = $null
    $confirmText = $null
}

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("dnp-export-{0}" -f [guid]::NewGuid())
$payloadRoot = Join-Path $temporaryRoot "payload"
$archivePath = Join-Path $temporaryRoot "payload.zip"
$bundleFolder = Join-Path $OutputDirectory ("DNP-Ai-Radar-Portable-{0}" -f (Get-Date -Format "yyyy-MM-dd-HHmm"))

try {
    New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
    Write-Host "Copying the current software..." -ForegroundColor Cyan
    Push-Location $repoRoot
    try { $projectFiles = git ls-files -co --exclude-standard } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "The project file list could not be created." }
    foreach ($relativePath in $projectFiles) {
        $sourcePath = Join-Path $repoRoot $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { continue }
        $destinationPath = Join-Path $payloadRoot $relativePath
        $destinationParent = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationParent)) {
            New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }
    Copy-Item -LiteralPath $rootEnvPath -Destination (Join-Path $payloadRoot ".env") -Force
    New-Item -ItemType Directory -Path (Join-Path $payloadRoot "apps\web") -Force | Out-Null
    Copy-Item -LiteralPath $webEnvPath -Destination (Join-Path $payloadRoot "apps\web\.env") -Force

    $passwordBytes = [byte[]]::new(32)
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($passwordBytes) } finally { $random.Dispose() }
    $internalPassword = -join ($passwordBytes | ForEach-Object { $_.ToString("x2") })
    $internalUrl = "postgres://postgres:${internalPassword}@postgres:5432/dnp_ai_radar"
    foreach ($portableEnv in @((Join-Path $payloadRoot ".env"), (Join-Path $payloadRoot "apps\web\.env"))) {
        Set-EnvValue -Path $portableEnv -Name "DATABASE_URL" -Value $internalUrl
        Set-EnvValue -Path $portableEnv -Name "POSTGRES_USER" -Value "postgres"
        Set-EnvValue -Path $portableEnv -Name "POSTGRES_PASSWORD" -Value $internalPassword
        Set-EnvValue -Path $portableEnv -Name "POSTGRES_DB" -Value "dnp_ai_radar"
        Set-EnvValue -Path $portableEnv -Name "APP_URL" -Value "http://localhost:3000"
        Set-EnvValue -Path $portableEnv -Name "VITE_APP_URL" -Value "http://localhost:3000"
    }

    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "portable-compose.yaml") -Destination $payloadRoot
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Start-DNP-Ai-Radar.ps1") -Destination $payloadRoot
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Stop-DNP-Ai-Radar.ps1") -Destination $payloadRoot
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "START-DNP-AI-RADAR.cmd") -Destination $payloadRoot
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "STOP-DNP-AI-RADAR.cmd") -Destination $payloadRoot
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "PORTABLE-README.txt") -Destination $payloadRoot

    Write-Host "Exporting the current database..." -ForegroundColor Cyan
    $env:PGPASSWORD = $databasePassword
    try {
        & $pgDump --host $databaseUri.Host --port $databasePort --username $databaseUser --dbname $databaseName --format custom --no-owner --no-acl --file (Join-Path $payloadRoot "portable-data.dump")
        if ($LASTEXITCODE -ne 0) { throw "The database export failed." }
    }
    finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

    Write-Host "Compressing and encrypting the portable copy..." -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $payloadRoot,
        $archivePath,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )
    New-Item -ItemType Directory -Path $bundleFolder -Force | Out-Null
    Protect-PortableFile -InputPath $archivePath -OutputPath (Join-Path $bundleFolder "payload.dnp") -Password $password
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Install-DNP-Ai-Radar.ps1") -Destination $bundleFolder
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "INSTALL-DNP-AI-RADAR.cmd") -Destination $bundleFolder
    Copy-Item -LiteralPath $cryptoScript -Destination $bundleFolder
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "PORTABLE-README.txt") -Destination $bundleFolder

    Write-Host ""
    Write-Host "Portable copy created:" -ForegroundColor Green
    Write-Host $bundleFolder -ForegroundColor Green
    Write-Host "Copy that whole folder to the new Windows computer. Keep the transfer password separate." -ForegroundColor Yellow
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    $databasePassword = $null
}
