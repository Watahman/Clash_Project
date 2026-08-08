param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8"
)

$ErrorActionPreference = "Stop"

function Require-SafeFalseFlag {
    param(
        [Parameter(Mandatory = $true)] [string]$Content,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    $pattern = "(?mi)^\s*" + [regex]::Escape($Name) + "\s*:\s*[\"']?false[\"']?\s*$"
    if ($Content -notmatch $pattern) {
        throw "$Name must explicitly be false in cloudrun-env.yaml for the first Phase 8 deployment."
    }
}

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

if (-not (Test-Path "./cloudrun-env.yaml")) {
    throw "cloudrun-env.yaml is missing. Copy cloudrun-env.example.yaml and fill the non-secret production values first."
}

$envContent = Get-Content "./cloudrun-env.yaml" -Raw
Require-SafeFalseFlag -Content $envContent -Name "ADVANCED_STATS_COLLECTION_ENABLED"
Require-SafeFalseFlag -Content $envContent -Name "ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED"

Write-Host "Phase 8 safety gate passed: collection OFF, public enrollment OFF." -ForegroundColor Green
Write-Host "Deploying a tagged Cloud Run candidate with 0% production traffic..." -ForegroundColor Cyan

gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Could not select Google Cloud project '$ProjectId'." }

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Could not enable required Google Cloud services." }

gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
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
Write-Host "  /health = 200"
Write-Host "  /ready = 200"
Write-Host "  /InternalAdvancedStatsPoll = 404 while collection is disabled"
Write-Host ""
Write-Host "Do not move production traffic to the Phase 8 tag yet." -ForegroundColor Yellow
Write-Host "Next: configure the scheduler secret + one developer UUID against this tagged candidate, then deploy the isolated Cloudflare preview."
