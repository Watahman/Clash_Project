param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [Guid]$DeveloperUserId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll",
    [string]$SecretName = "clashpanel-advanced-stats-scheduler-secret"
)

$ErrorActionPreference = "Stop"

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $($Args -join ' ')"
    }
}

function Get-TaggedCandidateUrl {
    $service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) {
        throw "Cloud Run service '$ServiceName' was not found in $Region."
    }
    $tagTraffic = @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    $url = [string]$tagTraffic.url
    if (-not $url) {
        throw "Tagged Cloud Run candidate '$TagName' was not found. Run deploy-cloud-run-phase8.ps1 first."
    }
    return $url
}

Run-Gcloud config set project $ProjectId
Run-Gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com

$candidateUrl = Get-TaggedCandidateUrl

$serviceAccount = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format="value(spec.template.spec.serviceAccountName)").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not resolve the Cloud Run service account."
}
if (-not $serviceAccount) {
    $projectNumber = (& gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $projectNumber) {
        throw "Could not resolve the project number for the default Cloud Run service account."
    }
    $serviceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

$existingSecret = & gcloud secrets describe $SecretName --project $ProjectId --format="value(name)" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $existingSecret) {
    Run-Gcloud secrets create $SecretName --project $ProjectId --replication-policy="automatic"
}

$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($bytes)
} finally {
    $rng.Dispose()
}
$schedulerSecret = [Convert]::ToBase64String($bytes)
$tempSecretFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempSecretFile, $schedulerSecret, (New-Object System.Text.UTF8Encoding($false)))
    Run-Gcloud secrets versions add $SecretName --project $ProjectId --data-file=$tempSecretFile
} finally {
    Remove-Item $tempSecretFile -Force -ErrorAction SilentlyContinue
}

Run-Gcloud secrets add-iam-policy-binding $SecretName `
    --project $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/secretmanager.secretAccessor"

# Create a new tagged candidate revision, still with 0% normal production traffic.
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false,ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_ROLLOUT_USER_IDS=$DeveloperUserId" `
    --update-secrets="ADVANCED_STATS_SCHEDULER_SECRET=${SecretName}:latest" `
    --no-traffic `
    --tag $TagName

$candidateUrl = Get-TaggedCandidateUrl

$jobExists = & gcloud scheduler jobs describe $SchedulerJobName --project $ProjectId --location $Region --format="value(name)" 2>$null
if ($LASTEXITCODE -eq 0 -and $jobExists) {
    Run-Gcloud scheduler jobs update http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="*/5 * * * *" `
        --time-zone="Etc/UTC" `
        --uri="$candidateUrl/InternalAdvancedStatsPoll" `
        --http-method=POST `
        --headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="30s" `
        --max-retry-attempts=0
} else {
    Run-Gcloud scheduler jobs create http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="*/5 * * * *" `
        --time-zone="Etc/UTC" `
        --uri="$candidateUrl/InternalAdvancedStatsPoll" `
        --http-method=POST `
        --headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="30s" `
        --max-retry-attempts=0
}

# The job is intentionally paused during setup. Collection is also still disabled.
Run-Gcloud scheduler jobs pause $SchedulerJobName --project $ProjectId --location $Region

Write-Host "Phase 8 developer-only runtime configuration prepared." -ForegroundColor Green
Write-Host "  Tagged candidate URL: $candidateUrl"
Write-Host "  Normal production traffic to candidate: 0%"
Write-Host "  Public enrollment: OFF"
Write-Host "  Collection: OFF"
Write-Host "  Rollout allowlist: developer UUID only"
Write-Host "  Scheduler secret: Secret Manager"
Write-Host "  Scheduler job: targets tagged candidate, every 5 minutes, PAUSED"
Write-Host ""
Write-Host "No scheduled Advanced Stats collection is running yet." -ForegroundColor Yellow
Write-Host "Next: deploy the isolated Cloudflare preview against this tagged candidate and start Advanced Stats for the allowlisted linked account."
