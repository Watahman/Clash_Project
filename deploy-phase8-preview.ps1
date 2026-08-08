param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$ProxySecretName = "API_PROXY_SECRET"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "./wrangler.phase8-preview.jsonc")) {
    throw "wrangler.phase8-preview.jsonc is missing."
}

if (-not (Test-Path "./package.json")) {
    throw "Run this script from the Clash_Project root."
}

Write-Host "Building the current Advanced Stats candidate locally..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
}

$service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $service) {
    throw "Cloud Run service '$ServiceName' was not found in $Region. Deploy the Phase 8 backend candidate first."
}

$tagTraffic = @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
$candidateUrl = [string]$tagTraffic.url
if (-not $candidateUrl) {
    throw "Tagged Cloud Run candidate '$TagName' was not found. Run deploy-cloud-run-phase8.ps1 first."
}

$templateConfig = Get-Content "./wrangler.phase8-preview.jsonc" -Raw
if ($templateConfig -notmatch "__PHASE8_CANDIDATE_URL__") {
    throw "wrangler.phase8-preview.jsonc is missing the Phase 8 candidate URL placeholder."
}

$generatedConfigPath = Join-Path (Get-Location) ".wrangler.phase8-preview.generated.jsonc"
$generatedConfig = $templateConfig.Replace("__PHASE8_CANDIDATE_URL__", $candidateUrl)
[System.IO.File]::WriteAllText($generatedConfigPath, $generatedConfig, (New-Object System.Text.UTF8Encoding($false)))

$proxySecret = (& gcloud secrets versions access latest --secret=$ProxySecretName --project=$ProjectId).Trim()
if ($LASTEXITCODE -ne 0 -or -not $proxySecret) {
    Remove-Item $generatedConfigPath -Force -ErrorAction SilentlyContinue
    throw "Could not read Secret Manager secret '$ProxySecretName'. The preview reuses the existing production API proxy secret without exposing it in Git."
}

$tempSecretsFile = [System.IO.Path]::GetTempFileName()
try {
    $secretJson = @{ API_PROXY_SECRET = $proxySecret } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($tempSecretsFile, $secretJson, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "Deploying isolated workers.dev preview against $candidateUrl ..." -ForegroundColor Cyan
    npx wrangler deploy --config $generatedConfigPath --secrets-file $tempSecretsFile
    if ($LASTEXITCODE -ne 0) {
        throw "Cloudflare Phase 8 preview deployment failed."
    }
} finally {
    Remove-Item $tempSecretsFile -Force -ErrorAction SilentlyContinue
    Remove-Item $generatedConfigPath -Force -ErrorAction SilentlyContinue
    $proxySecret = $null
}

Write-Host "Phase 8 frontend preview deployed." -ForegroundColor Green
Write-Host "  Backend target: tagged '$TagName' Cloud Run candidate"
Write-Host "  Normal production traffic to candidate: 0%"
Write-Host "  Preview Worker: separate workers.dev Worker"
Write-Host "  Custom-domain route: none"
Write-Host "  Cron trigger: none"
Write-Host "  Upstream CORS origin: https://clashpanel.com (preview Worker only)"
Write-Host "  Production clashpanel.com: unchanged"
Write-Host ""
Write-Host "Use the workers.dev URL printed by Wrangler to sign in and open /app/advanced-stats."
Write-Host "For this preview, prefer normal email/password sign-in; the production Google OAuth callback still points to clashpanel.com."
