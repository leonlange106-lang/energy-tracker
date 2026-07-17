# Zählwerk – Ein-Klick-Deploy
#
# Nutzung (PowerShell, im Repo-Ordner):
#   .\deploy.ps1                         -> committet & pusht den aktuellen Stand
#   .\deploy.ps1 -Zip "$HOME\Downloads\energy-tracker.zip"
#                                        -> entpackt das ZIP, spiegelt es ins Repo
#                                           (entfernt auch alte Dateien), commit & push
#
# Danach erkennt Home Assistant das Update automatisch (Add-on-Repository).

param([string]$Zip)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Zip) {
    if (-not (Test-Path $Zip)) { throw "ZIP nicht gefunden: $Zip" }
    $tmp = Join-Path $env:TEMP "zw_deploy"
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -Path $Zip -DestinationPath $tmp -Force
    # Das ZIP enthält den Ordner "energy-tracker" -> dessen Inhalt spiegeln
    $src = Join-Path $tmp "energy-tracker"
    if (-not (Test-Path $src)) { $src = $tmp }
    Write-Host "Spiegle neuen Stand ins Repo (alte Dateien werden entfernt)..." -ForegroundColor Cyan
    # /MIR spiegelt inkl. Löschen; .git und deploy.ps1 werden geschützt
    robocopy $src $PSScriptRoot /MIR /XD ".git" /XF "deploy.ps1" /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy-Fehler ($LASTEXITCODE)" }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# Version aus config.yaml lesen
$ver = (Select-String -Path "zaehlwerk\config.yaml" -Pattern 'version:\s*"([^"]+)"').Matches.Groups[1].Value

git add -A
if ((git status --porcelain).Length -eq 0) {
    Write-Host "Nichts zu committen – Repo ist bereits aktuell." -ForegroundColor Yellow
    exit 0
}
git commit -m "Deploy v$ver ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" | Out-Null
git push
Write-Host "`n[OK] Gepusht (v$ver). Home Assistant erkennt das Update automatisch." -ForegroundColor Green
Write-Host "     Add-on 'Zaehlwerk' -> Update-Button (oder Auto-Update, falls aktiviert)." -ForegroundColor Green
