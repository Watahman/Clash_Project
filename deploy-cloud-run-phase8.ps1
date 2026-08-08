param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8"
)

$ErrorActionPreference = "Stop"

function Get-HttpStatus {
    param(
        [Parameter(Mandatory = $true)] [string]$Url,
        [string]$Method = "GET"
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -UseBasicParsing -TimeoutSec 20
        return [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

if (-not (Test-Path "./Dockerfile")) {
    throw "Run this script from the Clash_Project root where Dockerfile exists."
}

Write-Host "Preparing zero-traffic Phase 8 candidate..." -ForegroundColor Cyan

gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    throw "Could not select Google Cloud project '$ProjectId'."
}

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
if ($LASTEXITCODE -ne 0) {
    throw "Could not enable required Google Cloud services."
}

# Confirm that the existing production service is present. The Phase 8 revision
# intentionally inherits its existing runtime configuration and Secret Manager
# references. Only the Advanced Stats rollout flags below are changed.
$before = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $before) {
    throw "Existing Cloud Run service '$ServiceName' was not found in $Region."
}

Write-Host "Existing Cloud Run service found. Production runtime config will be inherited." -ForegroundColor Green
Write-Host "Deploying current checkout with collection OFF, public enrollment OFF and 0% normal traffic..." -ForegroundColor Cyan

gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false" `
    --remove-env-vars="ADVANCED_STATS_ROLLOUT_USER_IDS" `
    --remove-secrets="ADVANCED_STATS_SCHEDULER_SECRET" `
    --no-traffic `
    --tag $TagName
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run Phase 8 candidate deployment failed."
}

$service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $service) {
    throw "Could not inspect the deployed Cloud Run service."
}

$tagTraffic = @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
$candidateUrl = [string]$tagTraffic.url
if (-not $candidateUrl) {
    throw "Could not resolve the tagged '$TagName' revision URL."
}

$tagPercent = 0
if ($null -ne $tagTraffic.percent -and [string]$tagTraffic.percent -ne "") {
    $tagPercent = [int]$tagTraffic.percent
}
if ($tagPercent -ne 0) {
    throw "Safety gate failed: tagged candidate unexpectedly has $tagPercent% normal production traffic."
}

Write-Host "Tagged candidate URL: $candidateUrl" -ForegroundColor Cyan
Write-Host "Production traffic to this revision: 0%" -ForegroundColor Green

$health = Get-HttpStatus -Url "$candidateUrl/health"
$ready = Get-HttpStatus -Url "$candidateUrl/ready"
$disabledPoll = Get-HttpStatus -Url "$candidateUrl/InternalAdvancedStatsPoll" -Method "POST"

if ($health -ne 200) {
    throw "/health returned $health instead of 200 on the tagged candidate."
}
if ($ready -ne 200) {
    throw "/ready returned $ready instead of 200 on the tagged candidate."
}
if ($disabledPoll -ne 404) {
    throw "/InternalAdvancedStatsPoll returned $disabledPoll instead of the expected 404 while collection is disabled."
}

Write-Host "Phase 8 first-deploy checks passed:" -ForegroundColor Green
Write-Host "  tagged candidate receives 0% normal production traffic"
Write-Host "  existing production runtime/secrets inherited"
Write-Host "  collection OFF"
Write-Host "  public enrollment OFF"
Write-Host "  rollout allowlist cleared"
Write-Host "  scheduler secret not attached yet"
Write-Host "  /health = 200"
Write-Host "  /ready = 200"
Write-Host "  /InternalAdvancedStatsPoll = 404 while collection is disabled"
Write-Host ""
Write-Host "Do not move production traffic to the Phase 8 tag yet." -ForegroundColor Yellow
Write-Host "Next: configure the scheduler secret + one developer UUID against this tagged candidate, then deploy the isolated Cloudflare preview."
