$ErrorActionPreference = "Stop"

$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptsDir
$buildDir = Join-Path $root "build"
$templateDir = Join-Path $root "ftp-hosting"
$outputDir = Join-Path $root "deploy-ftp"
$stagingDir = Join-Path $root "deploy-ftp-temp"
$backupScript = Join-Path $scriptsDir "yedekle.ps1"
$previousGenerateSourcemap = $env:GENERATE_SOURCEMAP

function Get-MainJsFromManifest {
    param([string]$ManifestPath)

    if (-not (Test-Path $ManifestPath)) {
        throw "Asset manifest bulunamadi: $ManifestPath"
    }

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $mainJs = $manifest.files.'main.js'
    if (-not $mainJs) {
        $mainJs = @($manifest.entrypoints | Where-Object { $_ -match "static/js/main\..*\.js$" } | Select-Object -First 1)
    }
    if (-not $mainJs) {
        throw "Asset manifest icinde main.js bulunamadi: $ManifestPath"
    }

    return [string]$mainJs
}

Push-Location $root
try {
    if (Test-Path $backupScript) {
        & $backupScript
        Write-Host ""
    }

    if (Test-Path $buildDir) {
        Remove-Item -LiteralPath $buildDir -Recurse -Force
    }

    $env:GENERATE_SOURCEMAP = "false"
    $LASTEXITCODE = 0
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build basarisiz oldu (exit code: $LASTEXITCODE). Paket olusturma durduruldu."
    }
    if (-not (Test-Path $buildDir)) {
        throw "Build klasoru bulunamadi: $buildDir"
    }

    $buildManifest = Join-Path $buildDir "asset-manifest.json"
    $buildIndex = Join-Path $buildDir "index.html"
    $buildMainJs = Get-MainJsFromManifest $buildManifest
    if (-not (Test-Path $buildIndex)) {
        throw "Build index.html bulunamadi: $buildIndex"
    }

    if (Test-Path $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $stagingDir | Out-Null

    # Template once, build last: current React build must always win over stale template files.
    Copy-Item -Path (Join-Path $templateDir "*") -Destination $stagingDir -Recurse -Force
    Copy-Item -Path (Join-Path $buildDir "*") -Destination $stagingDir -Recurse -Force

    $stagingConfig = Join-Path $stagingDir "api\config.php"
    if (Test-Path $stagingConfig) {
        Remove-Item -LiteralPath $stagingConfig -Force
    }

    $stagingManifest = Join-Path $stagingDir "asset-manifest.json"
    $stagingMainJs = Get-MainJsFromManifest $stagingManifest
    if ($stagingMainJs -ne $buildMainJs) {
        throw "Deploy paketi build ile uyusmuyor. Build: $buildMainJs / Staging: $stagingMainJs"
    }
    if (-not (Test-Path (Join-Path $stagingDir $stagingMainJs))) {
        throw "Deploy paketinde main JS bulunamadi: $stagingMainJs"
    }

    $mainJsFile = Get-Item -LiteralPath (Join-Path $stagingDir $stagingMainJs)
    $mainJsHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mainJsFile.FullName).Hash
    $buildInfo = @(
        "build=e-icerik-editor-deploy"
        "date=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        "mainJs=$stagingMainJs"
        "mainJsSha256=$mainJsHash"
        "configIncluded=false"
        "configPolicy=api/config.php deploy paketine yazilmaz; sunucudaki mevcut config korunur."
        "uploadCheck=Bu dosya sunucuda gorunmuyorsa yeni deploy yuklenmemistir."
    ) -join "`n"
    Set-Content -LiteralPath (Join-Path $stagingDir "DEPLOY-KONTROL.txt") -Value $buildInfo -Encoding UTF8

    if (Test-Path $outputDir) {
        Remove-Item -LiteralPath $outputDir -Recurse -Force
    }

    Move-Item -LiteralPath $stagingDir -Destination $outputDir

    Write-Host ""
    Write-Host "FTP paketi hazirlandi:" $outputDir
    Write-Host "Main JS:" $stagingMainJs
    Write-Host "api/config.php deploy paketine yazilmadi; sunucudaki mevcut config korunur."
}
catch {
    Write-Host "Paket hazirlanirken bir hata olustu: $_" -ForegroundColor Red
    exit 1
}
finally {
    $env:GENERATE_SOURCEMAP = $previousGenerateSourcemap
    Pop-Location
}
