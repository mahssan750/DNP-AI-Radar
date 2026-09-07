# One-time database setup for DNP-Ai-Radar.
#
# Asks for your PostgreSQL password without showing it or storing it in your
# command history, finds which of your PostgreSQL servers accepts it, creates
# the app's database if it is not there yet, and writes the connection line
# into both .env files.
#
# Run it from the project folder:   .\setup-database.ps1

$ErrorActionPreference = "Continue"

$PgHost   = "localhost"
$PgUser   = "postgres"
$Database = "dnp_ai_radar"

# This machine has more than one PostgreSQL installed, on different ports, and
# each has its own password. Rather than making you work out which is which,
# try them in turn with the password you give.
$Candidates = @(
    @{ Version = 18; Port = 5432; Bin = "C:\Program Files\PostgreSQL\18\bin" },
    @{ Version = 17; Port = 5433; Bin = "C:\Program Files\PostgreSQL\17\bin" }
)

$Candidates = $Candidates | Where-Object { Test-Path (Join-Path $_.Bin "psql.exe") }
if ($Candidates.Count -eq 0) {
    Write-Host "No PostgreSQL installation found under C:\Program Files\PostgreSQL." -ForegroundColor Red
    exit 1
}

$envFiles = @(".env", "apps\web\.env")
foreach ($f in $envFiles) {
    if (-not (Test-Path $f)) {
        Write-Host "Missing $f - run this from the project folder." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "PostgreSQL password for the '$PgUser' user" -ForegroundColor Cyan
Write-Host "(the password you chose when PostgreSQL was installed)"
$secure = Read-Host "Password" -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)

$env:PGPASSWORD = $plain
$chosen = $null

try {
    foreach ($c in $Candidates) {
        $psql = Join-Path $c.Bin "psql.exe"
        Write-Host ("Trying PostgreSQL {0} on port {1}... " -f $c.Version, $c.Port) -NoNewline
        & $psql -U $PgUser -h $PgHost -p $c.Port -d postgres -w -c "SELECT 1" *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "accepted." -ForegroundColor Green
            $chosen = $c
            break
        }
        Write-Host "rejected." -ForegroundColor DarkYellow
    }

    if (-not $chosen) {
        Write-Host ""
        Write-Host "That password was not accepted by any of your PostgreSQL servers." -ForegroundColor Red
        Write-Host "Nothing was changed." -ForegroundColor Red
        Write-Host ""
        Write-Host "Things to try:"
        Write-Host "  - Check for a typo, and for Caps Lock."
        Write-Host "  - If you use pgAdmin, the password saved there is the one to use."
        Write-Host "  - If you have genuinely lost it, the password can be reset - ask and"
        Write-Host "    I will talk you through it."
        exit 1
    }

    $psql     = Join-Path $chosen.Bin "psql.exe"
    $createdb = Join-Path $chosen.Bin "createdb.exe"
    $port     = $chosen.Port

    # Create the database, unless it is already there.
    $exists = & $psql -U $PgUser -h $PgHost -p $port -d postgres -w -tAc `
        "SELECT 1 FROM pg_database WHERE datname = '$Database'"
    if ($exists -eq "1") {
        Write-Host "Database '$Database' already exists - leaving it alone." -ForegroundColor Yellow
    } else {
        & $createdb -U $PgUser -h $PgHost -p $port -w $Database
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Could not create the database." -ForegroundColor Red
            exit 1
        }
        Write-Host "Created database '$Database'." -ForegroundColor Green
    }

    # A password can contain characters that break a URL, so escape it.
    $escaped = [uri]::EscapeDataString($plain)
    $line    = "DATABASE_URL=postgres://${PgUser}:${escaped}@${PgHost}:${port}/${Database}"

    foreach ($f in $envFiles) {
        $content = Get-Content $f -Raw
        $updated = [regex]::Replace(
            $content,
            '(?m)^DATABASE_URL=.*$',
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line }
        )
        Set-Content -Path $f -Value $updated -Encoding utf8 -NoNewline
        Write-Host "Updated $f" -ForegroundColor Green
    }
}
finally {
    # Do not leave the password sitting in this session.
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $plain = $null
}

Write-Host ""
Write-Host ("Done - using PostgreSQL {0} on port {1}." -f $chosen.Version, $chosen.Port) -ForegroundColor Cyan
Write-Host "Tell Claude it is finished, and it will create the tables and start the app."
Write-Host ""
