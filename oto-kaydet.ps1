param(
    [int]$AralikSaniye = 300,
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($AralikSaniye -lt 30) {
    throw "AralikSaniye en az 30 olmali."
}

Write-Host "Otomatik git kaydi basladi. Aralik: $AralikSaniye saniye" -ForegroundColor Cyan
Write-Host "Durdurmak icin Ctrl+C kullanabilirsin." -ForegroundColor DarkGray

while ($true) {
    try {
        $dirty = (& git status --porcelain 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $dirty) {
            Write-Host ""
            Write-Host ("[{0}] Degisiklik algilandi, kaydediliyor..." -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor Yellow
            if ($NoPush) {
                & "$PSScriptRoot\kaydet.ps1" -Auto -NoPush
            } else {
                & "$PSScriptRoot\kaydet.ps1" -Auto
            }
        }
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    Start-Sleep -Seconds $AralikSaniye
}
