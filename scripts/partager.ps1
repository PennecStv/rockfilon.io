# Partage une version de test de rockfilon via un tunnel Cloudflare (gratuit, sans compte).
# Usage : .\scripts\partager.ps1  -> affiche une URL https://….trycloudflare.com à envoyer. Ctrl+C pour couper.
# Seul le port 8000 (site + API) est exposé ; Postgres reste local. L'URL change à chaque lancement.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

docker compose up -d --build api  # site construit + API sur http://localhost:8000
if ($LASTEXITCODE -ne 0) { throw "docker compose a échoué (Docker Desktop est-il lancé ?)" }

$cf = Join-Path $root ".tools\cloudflared.exe"
if (-not (Test-Path $cf)) {
    New-Item -ItemType Directory -Force (Split-Path $cf) | Out-Null
    Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cf
}
$sig = Get-AuthenticodeSignature $cf
if ($sig.Status -ne "Valid" -or $sig.SignerCertificate.Subject -notmatch 'O="Cloudflare, Inc\."') {
    Remove-Item $cf
    throw "cloudflared.exe n'est pas signé par Cloudflare : supprimé."
}

& $cf tunnel --no-autoupdate --url http://localhost:8000
