# Zaehlwerk - Ein-Klick-Deploy (ASCII only, PS 5.1-kompatibel)
#
# Nutzung (PowerShell, im Repo-Ordner):
#   .\deploy.ps1                                   -> commit & push aktueller Stand
#   .\deploy.ps1 -Zip "$HOME\Downloads\energy-tracker.zip"
#                                                  -> ZIP entpacken, ins Repo spiegeln,
#                                                     commit & push
#   .\deploy.ps1 -NoTag                            -> ohne Git-Tag
#
# Das Skript prueft vorab, ob config.yaml, version.py und app.js dieselbe
# Version tragen, kopiert das Changelog in den Add-on-Ordner (dort sucht es
# der Supervisor) und setzt nach dem Push das passende Tag.
param([string]$Zip, [switch]$NoTag)
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

# --- Changelog fuer die Home-Assistant-Update-Ansicht ---------------------
# Der Supervisor sucht die Datei IM Add-on-Ordner (zaehlwerk\CHANGELOG.md),
# nicht im Repo-Root. Massgeblich bleibt die Datei im Root - GitHub zeigt sie
# dort an und Keep a Changelog sieht sie dort vor. Statt zwei gepflegter
# Kopien wird sie hier bei jedem Deploy kopiert; damit koennen sie nicht
# auseinanderlaufen.
if (Test-Path "CHANGELOG.md") {
    Copy-Item "CHANGELOG.md" "zaehlwerk\CHANGELOG.md" -Force
    Write-Host "Changelog in den Add-on-Ordner uebernommen." -ForegroundColor Cyan
} else {
    Write-Host "WARNUNG: CHANGELOG.md fehlt im Repo-Root." -ForegroundColor Yellow
}

# --- Versionsabgleich ------------------------------------------------------
# Drei Stellen tragen die Version. Laufen sie auseinander, bietet Home
# Assistant kein Update an oder die App meldet eine falsche Fassung.
$vPy = (Select-String -Path "zaehlwerk\app\version.py" -Pattern 'APP_VERSION\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
$vJs = (Select-String -Path "zaehlwerk\frontend\app.js" -Pattern 'const APP_VERSION\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
if ($ver -ne $vPy -or $ver -ne $vJs) {
    throw "Versionen weichen ab: config.yaml=$ver version.py=$vPy app.js=$vJs"
}
Write-Host "Version $ver an allen drei Stellen konsistent." -ForegroundColor Cyan

git add -A
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Nichts zu committen - Repo ist bereits aktuell." -ForegroundColor Yellow
    exit 0
}
git commit -m "Deploy v$ver" | Out-Null
git push

# --- Tag ------------------------------------------------------------------
# Nach dem Push, nicht davor: ein Tag vor dem Commit haengt am Vorgaenger.
if (-not $NoTag) {
    $tag = "v$ver"
    $exists = git tag -l $tag
    if ($exists) {
        Write-Host "Tag $tag besteht bereits - uebersprungen." -ForegroundColor Yellow
    } else {
        git tag -a $tag -m "Deploy $tag" | Out-Null
        git push origin $tag | Out-Null
        Write-Host "Tag $tag gesetzt und gepusht." -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "[OK] Gepusht (v$ver). Home Assistant erkennt das Update automatisch." -ForegroundColor Green
