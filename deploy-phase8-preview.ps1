param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
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

$serviceUrl = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format="value(status.url)").Trim()
if ($LASTEXITCODE -ne 0 -or -not $serviceUrl) {
    throw "Cloud Run service '$ServiceName' was not found in $Region. Deploy the Phase 8 backend candidate first."
}

$configText = Get-Content "./wrangler.phase8-preview.jsonc" -Raw
if ($configText -notmatch [regex]::Escape($serviceUrl)) {
    throw "wrangler.phase8-preview.jsonc CLOUD_RUN_ORIGIN does not match the deployed service URL: $serviceUrl"
}

$proxySecret = (& gcloud secrets versions access latest --secret=$ProxySecretName --project=$ProjectId).Trim()
if ($LASTEXITCODE -ne 0 -or -not $proxySecret) {
    throw "Could not read Secret Manager secret '$ProxySecretName'. The preview reuses the existing production API proxy secret without exposing it in Git."
}

$tempSecretsFile = [System.IO.Path]::GetTempFileName()
try {
    $secretJson = @{ API_PROXY_SECRET = $proxySecret } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($tempSecretsFile, $secretJson, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "Deploying isolated workers.dev preview..." -ForegroundColor Cyan
    npx wrangler deploy --config ./wrangler.phase8-preview.jsonc --secrets-file $tempSecretsFile
    if ($LASTEXITCODE -ne 0) {
        throw "Cloudflare Phase 8 preview deployment failed."
    }
} finally {
    Remove-Item $tempSecretsFile -Force -ErrorAction SilentlyContinue
    $proxySecret = $null
}

Write-Host "Phase 8 frontend preview deployed." -ForegroundColor Green
Write-Host "This Worker has no custom-domain route and no cron trigger. Production clashpanel.com is unchanged."
Write-Host "Use the workers.dev URL printed by Wrangler to sign in and open /app/advanced-stats."
Write-Host "For the preview, prefer normal email/password sign-in; the production Google OAuth callback still points to clashpanel.com."
