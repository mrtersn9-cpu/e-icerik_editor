$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $root "build"
$templateDir = Join-Path $root "ftp-hosting"
$outputDir = Join-Path $root "deploy-ftp"
$stagingDir = Join-Path $root "deploy-ftp-temp"
$outputConfig = Join-Path $outputDir "api\config.php"
$backupScript = Join-Path $root "yedekle.ps1"
$preservedConfig = $null

Push-Location $root
try {
    if (Test-Path $backupScript) {
        & $backupScript
        Write-Host ""
    }

    npm run build

    if (Test-Path $outputConfig) {
        $preservedConfig = Get-Content -LiteralPath $outputConfig -Raw
    }

    if (Test-Path $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $stagingDir | Out-Null
    Copy-Item -Path (Join-Path $buildDir "*") -Destination $stagingDir -Recurse -Force
    Copy-Item -Path (Join-Path $templateDir "*") -Destination $stagingDir -Recurse -Force

    if ($null -ne $preservedConfig) {
        $stagingConfig = Join-Path $stagingDir "api\config.php"
        Set-Content -LiteralPath $stagingConfig -Value $preservedConfig -Encoding UTF8
    }

    if (Test-Path $outputDir) {
        Remove-Item -LiteralPath $outputDir -Recurse -Force
    }

    Move-Item -LiteralPath $stagingDir -Destination $outputDir

    Write-Host ""
    Write-Host "FTP paketi hazirlandi:" $outputDir
    if ($null -ne $preservedConfig) {
        Write-Host "Mevcut api/config.php korundu."
    } else {
        Write-Host "config dosyasini duzenleyip bu klasorun icerigini sitene yukleyebilirsin."
    }
}
catch {
    Write-Host "Paket hazirlanirken bir hata olustu: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
