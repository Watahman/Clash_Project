param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll-phase8",
    [string]$SecretName = "clashpanel-advanced-stats-scheduler-secret-phase8",
    [Guid]$DeveloperUserId
)

$ErrorActionPreference = "Stop"

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $($Args -join ' ')"
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

function Get-Service {
    $service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) {
        throw "Existing Cloud Run service '$ServiceName' was not found in $Region."
    }
    return $service
}

function Get-TaggedTraffic($service) {
    return @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
}

function Get-ExistingRolloutUserIds($tagTraffic) {
    if (-not $tagTraffic -or -not $tagTraffic.revisionName) { return "" }
    $revision = (& gcloud run revisions describe $tagTraffic.revisionName `
        --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $revision) { return "" }
    $entry = @($revision.spec.containers[0].env) `
        | Where-Object { $_.name -eq "ADVANCED_STATS_ROLLOUT_USER_IDS" } `
        | Select-Object -First 1
    return [string]$entry.value
}

function Secret-Exists {
    $name = (& gcloud secrets describe $SecretName --project $ProjectId --format="value(name)" 2>$null)
    return $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($name -join ""))
}

function Scheduler-Exists {
    $name = (& gcloud scheduler jobs describe $SchedulerJobName `
        --project $ProjectId --location $Region --format="value(name)" 2>$null)
    return $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($name -join ""))
}

function Get-SchedulerState {
    $state = (& gcloud scheduler jobs describe $SchedulerJobName `
        --project $ProjectId --location $Region --format="value(state)" 2>$null)
    if ($LASTEXITCODE -ne 0) { return "" }
    return ($state -join "").Trim()
}

if (-not (Test-Path "./Dockerfile")) {
    throw "Run this script from the Clash_Project root where Dockerfile exists."
}

Write-Host "Preparing zero-traffic Phase 8 candidate..." -ForegroundColor Cyan
Run-Gcloud config set project $ProjectId
Run-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com

$before = Get-Service
$existingTag = Get-TaggedTraffic $before
$configured = $existingTag -and (Secret-Exists) -and (Scheduler-Exists)

if (-not $configured) {
    # First-time bootstrap only. This creates the tagged candidate without enabling
    # collection. configure-advanced-stats-phase8.ps1 + activation are required once.
    Write-Host "Phase 8 has not been configured yet; creating the first safe tagged candidate." -ForegroundColor Yellow
    Run-Gcloud run deploy $ServiceName `
        --source . `
        --project $ProjectId `
        --region $Region `
        --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false" `
        --remove-env-vars="ADVANCED_STATS_ROLLOUT_USER_IDS" `
        --remove-secrets="ADVANCED_STATS_SCHEDULER_SECRET" `
        --no-traffic `
        --tag $TagName

    $service = Get-Service
    $tagTraffic = Get-TaggedTraffic $service
    $candidateUrl = [string]$tagTraffic.url
    if (-not $candidateUrl) { throw "Could not resolve the tagged '$TagName' revision URL." }

    $health = Get-HttpStatus -Url "$candidateUrl/health"
    $ready = Get-HttpStatus -Url "$candidateUrl/ready"
    $disabledPoll = Get-HttpStatus -Url "$candidateUrl/InternalAdvancedStatsPoll" -Method "POST"
    if ($health -ne 200 -or $ready -ne 200 -or $disabledPoll -ne 404) {
        throw "First Phase 8 candidate checks failed (health=$health ready=$ready poll=$disabledPoll)."
    }

    Write-Host "First Phase 8 candidate deployed with 0% production traffic and collection OFF." -ForegroundColor Green
    Write-Host "Run configure-advanced-stats-phase8.ps1 once, then activate-advanced-stats-phase8.ps1 once."
    exit 0
}

# Phase 8 is already configured. Reuse its isolated scheduler secret and rollout
# allowlist so a normal code update creates only ONE new Cloud Run revision.
$rolloutUserIds = if ($DeveloperUserId -and $DeveloperUserId -ne [Guid]::Empty) {
    $DeveloperUserId.ToString()
} else {
    Get-ExistingRolloutUserIds $existingTag
}
if ([string]::IsNullOrWhiteSpace($rolloutUserIds)) {
    throw "Could not recover the Phase 8 rollout user id. Re-run with -DeveloperUserId <UUID>."
}

Write-Host "Configured Phase 8 detected. Deploying one active preview revision with 0% production traffic..." -ForegroundColor Cyan
Run-Gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=true,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false,ADVANCED_STATS_ROLLOUT_USER_IDS=$rolloutUserIds" `
    --update-secrets="ADVANCED_STATS_SCHEDULER_SECRET=${SecretName}:latest" `
    --no-traffic `
    --tag $TagName

$service = Get-Service
$tagTraffic = Get-TaggedTraffic $service
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

$health = Get-HttpStatus -Url "$candidateUrl/health"
$ready = Get-HttpStatus -Url "$candidateUrl/ready"
$unauthorizedPoll = Get-HttpStatus -Url "$candidateUrl/InternalAdvancedStatsPoll" -Method "GET"
if ($health -ne 200) { throw "/health returned $health instead of 200 on the tagged candidate." }
if ($ready -ne 200) { throw "/ready returned $ready instead of 200 on the tagged candidate." }
if ($unauthorizedPoll -ne 405) {
    throw "/InternalAdvancedStatsPoll GET returned $unauthorizedPoll instead of 405 while collection is enabled."
}

# Keep the existing secret header untouched; only point the isolated preview job
# at the newly tagged revision and keep its one-minute test cadence.
Run-Gcloud scheduler jobs update http $SchedulerJobName `
    --project $ProjectId `
    --location $Region `
    --schedule="* * * * *" `
    --time-zone="Etc/UTC" `
    --uri="$candidateUrl/InternalAdvancedStatsPoll" `
    --http-method=POST `
    --attempt-deadline="120s" `
    --max-retry-attempts=0

if ((Get-SchedulerState) -eq "PAUSED") {
    Run-Gcloud scheduler jobs resume $SchedulerJobName --project $ProjectId --location $Region
}

# Trigger one pass immediately. A healthy tracker may still be scheduled for a
# later poll; failed trackers become immediately due through the retry RPC.
Run-Gcloud scheduler jobs run $SchedulerJobName --project $ProjectId --location $Region

Write-Host "Phase 8 update deployed." -ForegroundColor Green
Write-Host "  Cloud Run revisions created by this update: 1"
Write-Host "  Tagged candidate URL: $candidateUrl"
Write-Host "  Production traffic to candidate: 0%"
Write-Host "  Collection: ON"
Write-Host "  Public enrollment: OFF"
Write-Host "  Preview scheduler: updated + running"
Write-Host "  No configure/activate step is needed for normal future Phase 8 code updates."
