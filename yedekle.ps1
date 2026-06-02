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
$excludeNames = @(
    "node_modules",
    "build",
    "deploy-ftp",
    "deploy-ftp-temp",
    "deploy-ftp-guncel",
    "backups",
    "yedekler",
    ".git",
    ".kimi",
    ".claude",
    "tmp_restore",
    "video-frames",
    "örnek tasarım"
)
$excludePatterns = @(
    "build-check-*",
    "build-codex-check-*",
    "build-verify*",
    "tmp-*",
    "tmp-page*.png"
)
$nestedExcludePatterns = @(
    "data\pdf-output-*"
)
$importantExcludedFiles = @(
    @{
        Source = "deploy-ftp\api\config.php"
        Target = "GERI-YUKLEME-ICIN\deploy-api-config.php"
    },
    @{
        Source = "deploy-ftp\DEPLOY-KONTROL.txt"
        Target = "GERI-YUKLEME-ICIN\DEPLOY-KONTROL.txt"
    }
)

function Test-IsExcludedRootEntry {
    param([System.IO.FileSystemInfo]$Entry)

    if ($excludeNames -contains $Entry.Name) {
        return $true
    }

    foreach ($pattern in $excludePatterns) {
        if ($Entry.Name -like $pattern) {
            return $true
        }
    }

    return $false
}

function Remove-NestedBackupExcludes {
    param([string]$BasePath)

    foreach ($relativePattern in $nestedExcludePatterns) {
        $parentRelative = Split-Path -Parent $relativePattern
        $leafPattern = Split-Path -Leaf $relativePattern
        $parentPath = Join-Path $BasePath $parentRelative
        if (-not (Test-Path -LiteralPath $parentPath)) {
            continue
        }

        Get-ChildItem -LiteralPath $parentPath -Force |
            Where-Object { $_.Name -like $leafPattern } |
            ForEach-Object {
                Remove-Item -LiteralPath $_.FullName -Recurse -Force
            }
    }
}

function Write-BackupSizeSummary {
    param([string]$BasePath)

    Write-Host "Yedege dahil edilen en buyuk klasor/dosyalar:"
    Get-ChildItem -LiteralPath $BasePath -Force |
        ForEach-Object {
            $size = if ($_.PSIsContainer) {
                (Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
            } else {
                $_.Length
            }
            [pscustomobject]@{
                Name = $_.Name
                SizeMb = [math]::Round(($size / 1MB), 2)
            }
        } |
        Sort-Object -Property SizeMb -Descending |
        Select-Object -First 8 |
        ForEach-Object {
            Write-Host (" - {0}: {1} MB" -f $_.Name, $_.SizeMb)
        }
}

function Copy-ImportantExcludedFiles {
    param(
        [string]$RootPath,
        [string]$BasePath
    )

    foreach ($item in $importantExcludedFiles) {
        $sourcePath = Join-Path $RootPath $item.Source
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            continue
        }

        $targetPath = Join-Path $BasePath $item.Target
        $targetParent = Split-Path -Parent $targetPath
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }
}

function Write-RestoreNotes {
    param([string]$BasePath)

    $notes = @(
        "E-Icerik Editor geri yukleme notlari",
        "Olusturma zamani: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "",
        "Bu yedek sistemi geri dondurmek icin gereken kaynak kodu, public dosyalari, server/API dosyalari, docs, scripts, package dosyalari ve data klasorundeki proje verilerini icerir.",
        "Tekrar uretilebilen veya agir klasorler yedege alinmaz: node_modules, build, deploy-ftp, deploy-ftp-temp, yedekler, tmp klasorleri, ornek tasarim ve PDF cikti klasorleri.",
        "",
        "Canli sunucu config yedegi varsa: GERI-YUKLEME-ICIN/deploy-api-config.php",
        "Geri yuklemede bu dosyayi deploy-ftp/api/config.php veya sunucudaki api/config.php yerine koyabilirsin.",
        "",
        "Not: deploy-api-config.php veritabani sifresi icerebilir. Bu yedegi guvenli yerde sakla."
    )

    Set-Content -LiteralPath (Join-Path $BasePath "GERI-YUKLEME-NOTLARI.txt") -Value ($notes -join "`r`n") -Encoding UTF8
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Get-ChildItem -LiteralPath $root -Force | Where-Object { -not (Test-IsExcludedRootEntry $_) } | ForEach-Object {
        $destination = Join-Path $tempDir $_.Name
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }

    Remove-NestedBackupExcludes -BasePath $tempDir
    Copy-ImportantExcludedFiles -RootPath $root -BasePath $tempDir
    Write-RestoreNotes -BasePath $tempDir
    Write-BackupSizeSummary -BasePath $tempDir

    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $archivePath -CompressionLevel Optimal -Force
    Write-Host "Kod yedegi olusturuldu:" $archivePath
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
