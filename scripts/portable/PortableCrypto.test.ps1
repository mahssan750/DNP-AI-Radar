$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot "PortableCrypto.ps1")

function New-TestPassword {
    param([Parameter(Mandatory)][string]$Text)
    $password = [Security.SecureString]::new()
    foreach ($character in $Text.ToCharArray()) { $password.AppendChar($character) }
    $password.MakeReadOnly()
    return $password
}

$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ("dnp-portable-test-{0}" -f [guid]::NewGuid())
[IO.Directory]::CreateDirectory($testDirectory) | Out-Null
try {
    $inputPath = Join-Path $testDirectory "input.txt"
    $bundlePath = Join-Path $testDirectory "payload.dnp"
    $outputPath = Join-Path $testDirectory "output.txt"
    [IO.File]::WriteAllText($inputPath, "Portable encryption round-trip test.")

    $password = New-TestPassword "portable-test-passphrase"
    Protect-PortableFile -InputPath $inputPath -OutputPath $bundlePath -Password $password
    Unprotect-PortableFile -InputPath $bundlePath -OutputPath $outputPath -Password $password
    if ((Get-FileHash $inputPath).Hash -ne (Get-FileHash $outputPath).Hash) {
        throw "The decrypted file did not match the original."
    }

    $wrongPassword = New-TestPassword "different-test-passphrase"
    try {
        Unprotect-PortableFile -InputPath $bundlePath -OutputPath (Join-Path $testDirectory "wrong.txt") -Password $wrongPassword
        throw "An incorrect password was accepted."
    }
    catch {
        if ($_.Exception.Message -eq "An incorrect password was accepted.") { throw }
        if ($_.Exception.Message -notmatch "password is incorrect") { throw }
    }

    Write-Host "Portable encryption tests passed."
}
finally {
    [IO.Directory]::Delete($testDirectory, $true)
}
