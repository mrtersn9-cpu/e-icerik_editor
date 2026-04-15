param(
    [string]$Mesaj = "",
    [switch]$Auto,
    [switch]$NoPush,
    [switch]$NoPrepare,
    [switch]$Watch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Watch) {
    $watchScript = Join-Path $PSScriptRoot "oto-kaydet.ps1"
    if (-not (Test-Path $watchScript)) {
        Write-Host "oto-kaydet.ps1 bulunamadi." -ForegroundColor Red
        exit 1
    }

    $watchArgs = @()
    if ($NoPush) {
        $watchArgs += "-NoPush"
    }
    if ($NoPrepare) {
        $watchArgs += "-NoPrepare"
    }

    & $watchScript @watchArgs
    exit $LASTEXITCODE
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $output = & git @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output | Out-String).Trim()
    }
    return ($output | Out-String).TrimEnd()
}

function Get-ChangedStatusLines {
    $raw = Get-GitOutput -Args @("status", "--short")
    if (-not $raw) {
        return @()
    }
    return @($raw -split "`r?`n" | Where-Object { $_.Trim() })
}

function Get-ChangedFiles {
    $lines = Get-ChangedStatusLines
    $files = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        $pathPart = $line.Substring([Math]::Min(3, $line.Length)).Trim()
        if (-not $pathPart) { continue }
        if ($pathPart -match " -> ") {
            $pathPart = ($pathPart -split " -> ")[-1].Trim()
        }
        $files.Add($pathPart)
    }

    return @($files)
}

function New-AutoMessage {
    param(
        [string[]]$Files
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    if (-not $Files -or $Files.Count -eq 0) {
        return "Otomatik kayit - $timestamp"
    }

    $sample = @($Files | Select-Object -First 3 | ForEach-Object { Split-Path $_ -Leaf }) -join ", "
    $suffix = if ($Files.Count -gt 3) { " +$($Files.Count - 3) dosya" } else { "" }
    return "Otomatik kayit - $sample$suffix - $timestamp"
}

function Invoke-FtpPrepareIfNeeded {
    param(
        [switch]$SkipPrepare
    )

    if ($SkipPrepare) {
        Write-Host "FTP hazirlama atlandi (-NoPrepare)." -ForegroundColor Yellow
        return
    }

    $prepareScript = Join-Path $PSScriptRoot "hazirla-ftp.ps1"
    if (-not (Test-Path $prepareScript)) {
        Write-Host "hazirla-ftp.ps1 bulunamadi, FTP hazirlama atlandi." -ForegroundColor Yellow
        return
    }

    Write-Host "FTP paketi otomatik hazirlaniyor..." -ForegroundColor Cyan
    & $prepareScript
    Write-Host ""
}

function Ensure-Changelog {
    $path = Join-Path $PSScriptRoot "CHANGELOG.md"
    if (-not (Test-Path $path)) {
        @"
# Changelog

Bu dosya, proje icin alinan git kayitlarini ve surum notlarini tutar.

## 2026-04-14 - Initial commit — E-Icerik Editoru v5

- Projenin ilk git kaydi olusturuldu.

## 2026-04-14 - kaydet.ps1 eklendi — tek komutla GitHub'a push

- Tek komutla git add / commit / push akisi eklendi.
"@ | Set-Content -Path $path -Encoding UTF8
    }
    return $path
}

function Update-Changelog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [string[]]$Files
    )

    $path = Ensure-Changelog
    $existing = Get-Content $path -Raw
    $dateLabel = Get-Date -Format "yyyy-MM-dd HH:mm"
    $branch = Get-GitOutput -Args @("branch", "--show-current")
    $fileLines = if ($Files -and $Files.Count -gt 0) {
        [string]::Join([Environment]::NewLine, ($Files | ForEach-Object { "- " + $_ }))
    } else {
        "- Dosya degisikligi algilanmadi."
    }

    $entry = @"
## $dateLabel - $Message

- Dal: $branch
- Commit hazirlandi.
$fileLines

"@

    if ($existing.StartsWith("# Changelog")) {
        $updated = $existing -replace "(?s)^# Changelog\s*", "# Changelog`r`n`r`n$entry"
    } else {
        $updated = "# Changelog`r`n`r`n$entry$existing"
    }

    Set-Content -Path $path -Value $updated -Encoding UTF8
}

try {
    $null = Get-GitOutput -Args @("rev-parse", "--is-inside-work-tree")
} catch {
    Write-Host "Bu klasor bir git deposu degil." -ForegroundColor Red
    exit 1
}

$changedFiles = Get-ChangedFiles
if (-not $changedFiles -or $changedFiles.Count -eq 0) {
    Write-Host "Kaydedilecek degisiklik yok." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Degisen dosyalar:" -ForegroundColor Cyan
Get-ChangedStatusLines | ForEach-Object { Write-Host $_ }
Write-Host ""

Invoke-FtpPrepareIfNeeded -SkipPrepare:$NoPrepare
$changedFiles = Get-ChangedFiles

if (-not $Mesaj) {
    if ($Auto) {
        $Mesaj = New-AutoMessage -Files $changedFiles
    } else {
        $Mesaj = Read-Host "Surum notu (bos birakirsan otomatik olusur)"
        if (-not $Mesaj) {
            $Mesaj = New-AutoMessage -Files $changedFiles
        }
    }
}

Update-Changelog -Message $Mesaj -Files $changedFiles

Get-GitOutput -Args @("add", "-A") | Out-Null
$commitOutput = Get-GitOutput -Args @("commit", "-m", $Mesaj)

Write-Host $commitOutput -ForegroundColor Green

if ($NoPush) {
    Write-Host ""
    Write-Host "Push atlandi (-NoPush)." -ForegroundColor Yellow
    exit 0
}

$remotes = Get-GitOutput -Args @("remote")
if (-not $remotes) {
    Write-Host ""
    Write-Host "Yerel commit alindi. Uzak repo tanimli olmadigi icin push yapilmadi." -ForegroundColor Yellow
    exit 0
}

$branch = Get-GitOutput -Args @("branch", "--show-current")
Write-Host ""
Write-Host "Push gonderiliyor: origin/$branch" -ForegroundColor Cyan
$pushOutput = & git push origin $branch 2>&1
if ($LASTEXITCODE -eq 0) {
    ($pushOutput | Out-String).Trim() | Write-Host -ForegroundColor Green
    Write-Host "Git kaydi tamamlandi." -ForegroundColor Green
    exit 0
}

Write-Host (($pushOutput | Out-String).Trim()) -ForegroundColor Yellow
Write-Host "Commit alindi ama push tamamlanamadi. Remote veya baglanti kontrol edilmeli." -ForegroundColor Yellow
exit 0
