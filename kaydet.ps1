# ─── E-İçerik Editörü — GitHub'a Kaydet ────────────────────────────────────
# Kullanım: .\kaydet.ps1
#           .\kaydet.ps1 "v5.2 - Timeline dark tema düzeltildi"

param(
    [string]$Mesaj = ""
)

Set-Location $PSScriptRoot

# Değişiklik var mı kontrol et
$degisiklik = git status --porcelain
if (-not $degisiklik) {
    Write-Host "✓ Kaydedilecek değişiklik yok." -ForegroundColor Green
    exit 0
}

# Değişen dosyaları göster
Write-Host ""
Write-Host "── Değişen dosyalar ──────────────────────" -ForegroundColor Cyan
git status --short
Write-Host ""

# Commit mesajı al
if (-not $Mesaj) {
    $tarih = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Mesaj = Read-Host "Sürüm notu (boş bırakırsan otomatik): "
    if (-not $Mesaj) {
        $Mesaj = "Güncelleme — $tarih"
    }
}

# Tüm dosyaları ekle ve commit yap
git add .
git commit -m $Mesaj

# Push et
Write-Host ""
Write-Host "── GitHub'a gönderiliyor... ──────────────" -ForegroundColor Cyan
git push origin master 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ GitHub'a kaydedildi: $Mesaj" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ Push başarısız. İnternet bağlantısını kontrol et." -ForegroundColor Red
}
