param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [switch]$AllowAdvancedStatsCollectionDisabled
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "./Dockerfile")) {
    throw "Voer dit script uit vanuit de hoofdmap van Clash_Project, waar Dockerfile staat."
}

if (-not (Test-Path "./cloudrun-env.yaml")) {
    throw "Maak eerst cloudrun-env.yaml op basis van cloudrun-env.example.yaml."
}

# A production deploy used to be able to silently copy the old rollout default
# ADVANCED_STATS_COLLECTION_ENABLED=false back into Cloud Run. Existing trackers
# would then stay INITIALIZING forever because /InternalAdvancedStatsPoll returns
# 404 before the scheduler can collect anything. Require an explicit kill-switch
# override when collection is intentionally disabled.
$cloudRunEnv = Get-Content "./cloudrun-env.yaml" -Raw
$collectionEnabled = $cloudRunEnv -match '(?im)^\s*ADVANCED_STATS_COLLECTION_ENABLED\s*:\s*["'']?true["'']?\s*(?:#.*)?$'
if (-not $collectionEnabled -and -not $AllowAdvancedStatsCollectionDisabled) {
    throw "ADVANCED_STATS_COLLECTION_ENABLED moet true zijn voor een normale production deploy. Gebruik -AllowAdvancedStatsCollectionDisabled alleen als bewuste kill switch."
}

$rankedSeasonConfigured = $cloudRunEnv -match '(?im)^\s*CLASHKING_RANKED_SEASON\s*:\s*["'']?[1-9][0-9]*["'']?\s*(?:#.*)?$'
if ($rankedSeasonConfigured) {
    Write-Host "CLASHKING_RANKED_SEASON override gevonden; automatische ClashKing season discovery wordt voor ranked overgeslagen." -ForegroundColor Cyan
} else {
    Write-Host "Ranked season wordt automatisch opgelost via ClashKing V2 /v2/dates/current." -ForegroundColor Cyan
}

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# The same project key is used by Development and Production; the
# environment label in cloudrun-env.yaml keeps their events separate.
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 40 `
    --timeout 120s `
    --cpu-boost `
    --no-cpu-throttling `
    --env-vars-file ./cloudrun-env.yaml `
    --update-secrets="POSTHOG_PROJECT_API_KEY=POSTHOG_PROJECT_API_KEY:latest" `
    --remove-secrets="CLASH_API_KEY_POOL,_API_KEY_ALL,_API_KEY_ALL2,_API_KEY_ALL3"

if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deploy is mislukt."
}

Write-Host "Deploy klaar. Controleer daarna de Advanced Stats scheduler met configure-advanced-stats-production.ps1." -ForegroundColor Green
Write-Host "Configureer de overige secrets in Cloud Run / Secret Manager:"
Write-Host "  _API_KEY_SUPABASE"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY"
Write-Host "  API_PROXY_SECRET (dezelfde waarde als de Cloudflare Worker secret)"
Write-Host "  ADVANCED_STATS_SCHEDULER_SECRET"
Write-Host "  POSTHOG_PROJECT_API_KEY (shared PostHog project key)"
