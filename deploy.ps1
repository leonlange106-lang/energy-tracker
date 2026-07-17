# Zaehlwerk - Ein-Klick-Deploy (ASCII only, PS 5.1-kompatibel)
#
# Nutzung (PowerShell, im Repo-Ordner):
#   .\deploy.ps1                                   -> commit & push aktueller Stand
#   .\deploy.ps1 -Zip "$HOME\Downloads\energy-tracker.zip"
#                                                  -> ZIP entpacken, ins Repo spiegeln,
#                                                     commit & push
param([string]$Zip)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Zip) {
    if (-not (Test-Path $Zip)) { throw "ZIP nicht gefunden: $Zip" }
    $tmp = Join-Path $env:TEMP "zw_deploy"
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -Path $Zip -DestinationPath $tmp -Force
    $src = Join-Path $tmp "energy-tracker"
    if (-not (Test-Path $src)) { $src = $tmp }
    Write-Host "Spiegle neuen Stand ins Repo (alte Dateien werden entfernt)..." -ForegroundColor Cyan
    robocopy $src $PSScriptRoot /MIR /XD ".git" /XF "deploy.ps1" /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy-Fehler ($LASTEXITCODE)" }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$ver = "unbekannt"
$m = Select-String -Path "zaehlwerk\config.yaml" -Pattern 'version:\s*"([^"]+)"'
if ($m) { $ver = $m.Matches[0].Groups[1].Value }

git add -A
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Nichts zu committen - Repo ist bereits aktuell." -ForegroundColor Yellow
    exit 0
}
git commit -m "Deploy v$ver" | Out-Null
git push
Write-Host ""
Write-Host "[OK] Gepusht (v$ver). Home Assistant erkennt das Update automatisch." -ForegroundColor Green
