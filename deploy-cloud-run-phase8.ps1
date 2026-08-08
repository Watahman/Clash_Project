param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api"
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
Write-Host "Deploying the current checkout as the staged candidate..." -ForegroundColor Cyan

& ./deploy-cloud-run.ps1 -ProjectId $ProjectId -Region $Region -ServiceName $ServiceName
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deployment failed."
}

$serviceUrl = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format="value(status.url)").Trim()
if (-not $serviceUrl) {
    throw "Could not resolve the deployed Cloud Run service URL."
}

Write-Host "Candidate URL: $serviceUrl" -ForegroundColor Cyan

$health = Get-HttpStatus -Url "$serviceUrl/health"
$ready = Get-HttpStatus -Url "$serviceUrl/ready"
$disabledPoll = Get-HttpStatus -Url "$serviceUrl/InternalAdvancedStatsPoll" -Method "POST"

if ($health -ne 200) {
    throw "/health returned $health instead of 200."
}
if ($ready -ne 200) {
    throw "/ready returned $ready instead of 200."
}
if ($disabledPoll -ne 404) {
    throw "/InternalAdvancedStatsPoll returned $disabledPoll instead of the expected 404 while collection is disabled."
}

Write-Host "Phase 8 first-deploy checks passed:" -ForegroundColor Green
Write-Host "  /health = 200"
Write-Host "  /ready = 200"
Write-Host "  /InternalAdvancedStatsPoll = 404 while collection is disabled"
Write-Host ""
Write-Host "Do not enable collection yet." -ForegroundColor Yellow
Write-Host "Next: configure ADVANCED_STATS_SCHEDULER_SECRET in Secret Manager and set only the developer UUID in ADVANCED_STATS_ROLLOUT_USER_IDS while keeping public enrollment false."
