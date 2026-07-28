param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api"
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
    --env-vars-file ./cloudrun-env.yaml

Write-Host "Deploy klaar. Voeg daarna de drie secrets toe in Cloud Run / Secret Manager:" -ForegroundColor Green
Write-Host "  _API_KEY_ALL"
Write-Host "  _API_KEY_SUPABASE"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY"
