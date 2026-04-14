param(
    [string]$VersionOverride = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupRoot = Join-Path $root "yedekler"
$packageJsonPath = Join-Path $root "package.json"

function Get-AppVersion {
    param(
        [string]$PackagePath,
        [string]$FallbackVersion
    )

    if ($FallbackVersion) {
        return $FallbackVersion
    }

    if (-not (Test-Path $PackagePath)) {
        return "0.0.0"
    }

    $packageJson = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    if ($null -ne $packageJson.version -and "$($packageJson.version)".Trim() -ne "") {
        return "$($packageJson.version)".Trim()
    }

    return "0.0.0"
}

$version = Get-AppVersion -PackagePath $packageJsonPath -FallbackVersion $VersionOverride
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$archiveName = "e-icerik-editor-v$version-$timestamp.zip"
$archivePath = Join-Path $backupRoot $archiveName
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("e-icerik-editor-backup-" + [guid]::NewGuid().ToString("N"))
$excludeNames = @("node_modules", "build", "deploy-ftp", "yedekler", ".git")

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Get-ChildItem -LiteralPath $root -Force | Where-Object { $excludeNames -notcontains $_.Name } | ForEach-Object {
        $destination = Join-Path $tempDir $_.Name
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }

    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $archivePath -CompressionLevel Optimal -Force
    Write-Host "Kod yedegi olusturuldu:" $archivePath
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
