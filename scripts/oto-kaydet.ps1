param(
    [int]$BeklemeSaniye = 6,
    [switch]$NoPush,
    [switch]$NoPrepare
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($BeklemeSaniye -lt 2) {
    throw "BeklemeSaniye en az 2 olmali."
}

$script:BekleyenDegisiklik = $false
$script:KayitCalisiyor = $false
$script:SonDegisiklikZamani = Get-Date
$script:SusturmaBitis = Get-Date "2000-01-01"

function Convert-ToRelativePath {
    param(
        [string]$Path
    )

    if (-not $Path) {
        return ""
    }

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPath = [System.IO.Path]::GetFullPath($root)

    if ($fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $fullPath.Substring($rootPath.Length).TrimStart("\", "/")
        return ($relative -replace "/", "\")
    }

    return ($fullPath -replace "/", "\")
}

function Test-IgnoredPath {
    param(
        [string]$Path
    )

    $relative = Convert-ToRelativePath -Path $Path
    if (-not $relative) {
        return $true
    }

    $lower = $relative.ToLowerInvariant()

    $ignoredPrefixes = @(
        ".git\",
        "node_modules\",
        "build\",
        "deploy-ftp\",
        "deploy-ftp-temp\"
    )

    foreach ($prefix in $ignoredPrefixes) {
        if ($lower.StartsWith($prefix)) {
            return $true
        }
    }

    if ($lower -eq "docs\changelog.md") {
        return $true
    }

    if ($lower.StartsWith("data\pdf-output-")) {
        return $true
    }

    if ($lower.EndsWith(".tmp") -or $lower.EndsWith(".log") -or $lower.Contains("~")) {
        return $true
    }

    return $false
}

function Register-RepoChange {
    param(
        [string]$Path
    )

    if ((Get-Date) -lt $script:SusturmaBitis) {
        return
    }

    if (Test-IgnoredPath -Path $Path) {
        return
    }

    $script:BekleyenDegisiklik = $true
    $script:SonDegisiklikZamani = Get-Date
    $relative = Convert-ToRelativePath -Path $Path
    Write-Host ("[{0}] Degisiklik algilandi: {1}" -f (Get-Date -Format "HH:mm:ss"), $relative) -ForegroundColor DarkYellow
}

Write-Host "Anlik otomatik kayit acildi." -ForegroundColor Cyan
Write-Host "Kaydet komutu: .\\scripts\\kaydet.ps1 (otomatik tetiklenecek)" -ForegroundColor DarkGray
Write-Host "Durdurmak icin Ctrl+C kullanabilirsin." -ForegroundColor DarkGray
Write-Host "Izlenmeyen klasorler: .git, node_modules, build, deploy-ftp, deploy-ftp-temp, data\\pdf-output-*" -ForegroundColor DarkGray

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $root
$watcher.IncludeSubdirectories = $true
$watcher.Filter = "*"
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, DirectoryName, LastWrite, CreationTime, Size'
$watcher.EnableRaisingEvents = $true

$changedAction = {
    try {
        Register-RepoChange -Path $Event.SourceEventArgs.FullPath
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

$renamedAction = {
    try {
        Register-RepoChange -Path $Event.SourceEventArgs.FullPath
        Register-RepoChange -Path $Event.SourceEventArgs.OldFullPath
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

$handlers = @(
    (Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $changedAction),
    (Register-ObjectEvent -InputObject $watcher -EventName Created -Action $changedAction),
    (Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $changedAction),
    (Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $renamedAction)
)

try {
    while ($true) {
        Start-Sleep -Milliseconds 700

        if (-not $script:BekleyenDegisiklik) {
            continue
        }

        if ($script:KayitCalisiyor) {
            continue
        }

        $gecenSure = ((Get-Date) - $script:SonDegisiklikZamani).TotalSeconds
        if ($gecenSure -lt $BeklemeSaniye) {
            continue
        }

        $script:BekleyenDegisiklik = $false
        $script:KayitCalisiyor = $true

        try {
            $dirty = (& git status --porcelain 2>$null | Out-String).Trim()
            if ($LASTEXITCODE -ne 0) {
                throw "git status okunamadi."
            }

            if (-not $dirty) {
                continue
            }

            Write-Host ""
            Write-Host ("[{0}] Otomatik kayit basladi..." -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor Yellow

            $script:SusturmaBitis = (Get-Date).AddSeconds([Math]::Max(8, $BeklemeSaniye + 2))

            $kaydetArgs = @("-Auto")
            if ($NoPush) {
                $kaydetArgs += "-NoPush"
            }
            if ($NoPrepare) {
                $kaydetArgs += "-NoPrepare"
            }

            & "$PSScriptRoot\kaydet.ps1" @kaydetArgs
            Write-Host ""
        } catch {
            Write-Host $_.Exception.Message -ForegroundColor Red
        } finally {
            $script:KayitCalisiyor = $false
        }
    }
}
finally {
    $watcher.EnableRaisingEvents = $false
    foreach ($handler in $handlers) {
        if ($null -ne $handler) {
            Unregister-Event -SourceIdentifier $handler.Name -ErrorAction SilentlyContinue
            Remove-Job -Id $handler.Id -Force -ErrorAction SilentlyContinue
        }
    }
    $watcher.Dispose()
}
