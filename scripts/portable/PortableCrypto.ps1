Set-StrictMode -Version Latest

$script:PortableMagic = [Text.Encoding]::ASCII.GetBytes("DNPPORT1")
$script:PortableIterations = 300000

function ConvertFrom-PortableSecureString {
    param([Parameter(Mandatory)][Security.SecureString]$SecureString)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Test-PortableBytesEqual {
    param(
        [Parameter(Mandatory)][byte[]]$Left,
        [Parameter(Mandatory)][byte[]]$Right
    )

    if ($Left.Length -ne $Right.Length) { return $false }
    $difference = 0
    for ($index = 0; $index -lt $Left.Length; $index++) {
        $difference = $difference -bor ($Left[$index] -bxor $Right[$index])
    }
    return $difference -eq 0
}

function New-PortableKeys {
    param(
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][byte[]]$Salt
    )

    $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new(
        $Password,
        $Salt,
        $script:PortableIterations,
        [Security.Cryptography.HashAlgorithmName]::SHA256
    )
    try {
        $material = $derive.GetBytes(64)
        return @{
            Encryption = $material[0..31]
            Authentication = $material[32..63]
        }
    }
    finally {
        $derive.Dispose()
    }
}

function Protect-PortableFile {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath,
        [Parameter(Mandatory)][Security.SecureString]$Password
    )

    $salt = [byte[]]::new(32)
    $iv = [byte[]]::new(16)
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($salt)
        $random.GetBytes($iv)
    }
    finally { $random.Dispose() }
    $plainPassword = ConvertFrom-PortableSecureString $Password
    $keys = New-PortableKeys -Password $plainPassword -Salt $salt
    $plainPassword = $null

    $cipherPath = [IO.Path]::GetTempFileName()
    try {
        $aes = [Security.Cryptography.Aes]::Create()
        $aes.Key = $keys.Encryption
        $aes.IV = $iv
        $aes.Mode = [Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7

        $input = [IO.File]::OpenRead($InputPath)
        $cipher = [IO.File]::Create($cipherPath)
        $crypto = [Security.Cryptography.CryptoStream]::new(
            $cipher,
            $aes.CreateEncryptor(),
            [Security.Cryptography.CryptoStreamMode]::Write
        )
        try {
            $input.CopyTo($crypto)
            $crypto.FlushFinalBlock()
        }
        finally {
            $crypto.Dispose()
            $input.Dispose()
            $aes.Dispose()
        }

        $output = [IO.File]::Create($OutputPath)
        try {
            $output.Write($script:PortableMagic, 0, $script:PortableMagic.Length)
            $output.Write($salt, 0, $salt.Length)
            $output.Write($iv, 0, $iv.Length)
            $cipherInput = [IO.File]::OpenRead($cipherPath)
            try { $cipherInput.CopyTo($output) } finally { $cipherInput.Dispose() }
        }
        finally { $output.Dispose() }

        $hmac = [Security.Cryptography.HMACSHA256]::new($keys.Authentication)
        $authenticated = [IO.File]::OpenRead($OutputPath)
        try { $mac = $hmac.ComputeHash($authenticated) } finally { $authenticated.Dispose(); $hmac.Dispose() }
        $append = [IO.File]::Open($OutputPath, [IO.FileMode]::Append, [IO.FileAccess]::Write)
        try { $append.Write($mac, 0, $mac.Length) } finally { $append.Dispose() }
    }
    finally {
        Remove-Item -LiteralPath $cipherPath -Force -ErrorAction SilentlyContinue
        if ($keys) {
            [Array]::Clear($keys.Encryption, 0, $keys.Encryption.Length)
            [Array]::Clear($keys.Authentication, 0, $keys.Authentication.Length)
        }
    }
}

function Unprotect-PortableFile {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath,
        [Parameter(Mandatory)][Security.SecureString]$Password
    )

    $headerLength = $script:PortableMagic.Length + 32 + 16
    $macLength = 32
    $file = [IO.File]::OpenRead($InputPath)
    try {
        if ($file.Length -le ($headerLength + $macLength)) { throw "The portable bundle is incomplete." }
        $magic = [byte[]]::new($script:PortableMagic.Length)
        [void]$file.Read($magic, 0, $magic.Length)
        if (-not (Test-PortableBytesEqual -Left $magic -Right $script:PortableMagic)) {
            throw "This is not a DNP AI Radar portable bundle."
        }
        $salt = [byte[]]::new(32)
        $iv = [byte[]]::new(16)
        [void]$file.Read($salt, 0, $salt.Length)
        [void]$file.Read($iv, 0, $iv.Length)
        $cipherLength = $file.Length - $headerLength - $macLength
        $file.Position = $file.Length - $macLength
        $expectedMac = [byte[]]::new($macLength)
        [void]$file.Read($expectedMac, 0, $expectedMac.Length)
    }
    finally { $file.Dispose() }

    $plainPassword = ConvertFrom-PortableSecureString $Password
    $keys = New-PortableKeys -Password $plainPassword -Salt $salt
    $plainPassword = $null
    try {
        $hmac = [Security.Cryptography.HMACSHA256]::new($keys.Authentication)
        $authInput = [IO.File]::OpenRead($InputPath)
        try {
            $remaining = $authInput.Length - $macLength
            $buffer = [byte[]]::new(1048576)
            while ($remaining -gt 0) {
                $count = [Math]::Min($buffer.Length, $remaining)
                $read = $authInput.Read($buffer, 0, $count)
                if ($read -eq 0) { throw "The portable bundle ended unexpectedly." }
                $remaining -= $read
                if ($remaining -eq 0) {
                    [void]$hmac.TransformFinalBlock($buffer, 0, $read)
                }
                else {
                    [void]$hmac.TransformBlock($buffer, 0, $read, $buffer, 0)
                }
            }
            $actualMac = $hmac.Hash
        }
        finally { $authInput.Dispose(); $hmac.Dispose() }

        if (-not (Test-PortableBytesEqual -Left $actualMac -Right $expectedMac)) {
            throw "The password is incorrect, or the bundle has been damaged."
        }

        $aes = [Security.Cryptography.Aes]::Create()
        $aes.Key = $keys.Encryption
        $aes.IV = $iv
        $aes.Mode = [Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
        $source = [IO.File]::OpenRead($InputPath)
        $destination = [IO.File]::Create($OutputPath)
        $crypto = [Security.Cryptography.CryptoStream]::new(
            $destination,
            $aes.CreateDecryptor(),
            [Security.Cryptography.CryptoStreamMode]::Write
        )
        try {
            $source.Position = $headerLength
            $remaining = $cipherLength
            $buffer = [byte[]]::new(1048576)
            while ($remaining -gt 0) {
                $count = [Math]::Min($buffer.Length, $remaining)
                $read = $source.Read($buffer, 0, $count)
                if ($read -eq 0) { throw "The portable bundle ended unexpectedly." }
                $crypto.Write($buffer, 0, $read)
                $remaining -= $read
            }
            $crypto.FlushFinalBlock()
        }
        finally {
            $crypto.Dispose()
            $source.Dispose()
            $aes.Dispose()
        }
    }
    finally {
        if ($keys) {
            [Array]::Clear($keys.Encryption, 0, $keys.Encryption.Length)
            [Array]::Clear($keys.Authentication, 0, $keys.Authentication.Length)
        }
    }
}
