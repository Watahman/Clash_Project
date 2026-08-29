param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [Guid]$DeveloperUserId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll-phase8",
    [string]$SecretName = "clashpanel-advanced-stats-scheduler-secret"
)

$ErrorActionPreference = "Stop"

function Format-SafeGcloudArgs {
    param([string[]]$Args)
    return ($Args | ForEach-Object {
        if ($_ -match '^--(?:headers|update-headers)=') {
            $flag = $_.Substring(0, $_.IndexOf('=') + 1)
            return "${flag}<redacted>"
        }
        if ($_ -match '^--update-secrets=') {
            return '--update-secrets=<redacted-binding>'
        }
        return $_
    }) -join ' '
}

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $(Format-SafeGcloudArgs $Args)"
    }
}

function Run-GcloudQuiet {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $null = & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $(Format-SafeGcloudArgs $Args)"
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

function Secret-Exists {
    $names = @(& gcloud secrets list --project $ProjectId --format="value(name)")
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list Secret Manager secrets."
    }
    return $names -contains $SecretName
}

function Get-SchedulerJobState {
    $rows = @(& gcloud scheduler jobs list --project $ProjectId --location $Region --format="csv[no-heading](name,state)")
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list Cloud Scheduler jobs in $Region."
    }

    foreach ($row in $rows) {
        if ([string]::IsNullOrWhiteSpace($row)) { continue }
        $parts = $row.Split(',', 2)
        if ($parts.Count -lt 2) { continue }
        $name = $parts[0].Trim()
        $state = $parts[1].Trim()
        if ($name -eq $SchedulerJobName -or $name.EndsWith("/$SchedulerJobName")) {
            return $state
        }
    }
    return $null
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

if (-not (Secret-Exists)) {
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
# Collection intentionally remains disabled until activate-advanced-stats-phase8.ps1 is run.
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false,ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_ROLLOUT_USER_IDS=$DeveloperUserId" `
    --update-secrets="ADVANCED_STATS_SCHEDULER_SECRET=${SecretName}:latest" `
    --no-traffic `
    --tag $TagName

$candidateUrl = Get-TaggedCandidateUrl

$jobState = Get-SchedulerJobState
if ($jobState) {
    Run-GcloudQuiet scheduler jobs update http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="* * * * *" `
        --time-zone="Etc/UTC" `
        --uri="$candidateUrl/InternalAdvancedStatsPoll" `
        --http-method=POST `
        --update-headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="120s" `
        --max-retry-attempts=0
} else {
    Run-GcloudQuiet scheduler jobs create http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="* * * * *" `
        --time-zone="Etc/UTC" `
        --uri="$candidateUrl/InternalAdvancedStatsPoll" `
        --http-method=POST `
        --headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="120s" `
        --max-retry-attempts=0
}

# The preview job is intentionally paused during setup. Activation is a separate,
# explicit step so production traffic remains untouched and no collection starts accidentally.
$jobState = Get-SchedulerJobState
if ($jobState -ne "PAUSED") {
    Run-Gcloud scheduler jobs pause $SchedulerJobName --project $ProjectId --location $Region
}

Write-Host "Phase 8 developer-only runtime configuration prepared." -ForegroundColor Green
Write-Host "  Tagged candidate URL: $candidateUrl"
Write-Host "  Normal production traffic to candidate: 0%"
Write-Host "  Public enrollment: OFF"
Write-Host "  Collection: OFF until explicit activation"
Write-Host "  Rollout allowlist: developer UUID only"
Write-Host "  Scheduler secret: Secret Manager"
Write-Host "  Preview scheduler job: $SchedulerJobName, every minute, PAUSED"
Write-Host ""
Write-Host "Next: run activate-advanced-stats-phase8.ps1 to enable collection only on the tagged preview revision." -ForegroundColor Yellow
