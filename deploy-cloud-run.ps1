param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$ClashApiKeyPoolSecret = "clashpanel-coc-api-key-pool"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "./Dockerfile")) {
    throw "Voer dit script uit vanuit de hoofdmap van Clash_Project, waar Dockerfile staat."
}

if (-not (Test-Path "./cloudrun-env.yaml")) {
    throw "Maak eerst cloudrun-env.yaml op basis van cloudrun-env.example.yaml."
}

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

$poolSecret = @(& gcloud secrets describe $ClashApiKeyPoolSecret `
    --project $ProjectId `
    --format="value(name)" 2>$null) -join ""
$poolSecret = $poolSecret.Trim()
if ($LASTEXITCODE -ne 0 -or -not $poolSecret) {
    throw "Secret Manager-secret '$ClashApiKeyPoolSecret' ontbreekt. Voer eerst migrate-clash-api-key-pool.ps1 uit."
}

gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 40 `
    --timeout 30s `
    --cpu-boost `
    --env-vars-file ./cloudrun-env.yaml `
    --update-secrets="CLASH_API_KEY_POOL=${ClashApiKeyPoolSecret}:latest" `
    --remove-secrets="_API_KEY_ALL,_API_KEY_ALL2,_API_KEY_ALL3"

Write-Host "Deploy klaar. Configureer daarna de secrets in Cloud Run / Secret Manager:" -ForegroundColor Green
Write-Host "  CLASH_API_KEY_POOL -> $ClashApiKeyPoolSecret"
Write-Host "  _API_KEY_SUPABASE"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY"
Write-Host "  API_PROXY_SECRET (dezelfde waarde als de Cloudflare Worker secret)"
Write-Host "  ADVANCED_STATS_SCHEDULER_SECRET (alleen nodig voor de Advanced Stats scheduler rollout)"
