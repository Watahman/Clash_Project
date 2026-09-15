param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [Guid]$DeveloperUserId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll-phase8",
    [string]$SecretName = "clashpanel-advanced-stats-scheduler-secret-phase8",
    [switch]$RotateSchedulerSecret
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

function Format-SafeGcloudOutput {
    param([object[]]$Output)
    $text = ($Output | ForEach-Object { [string]$_ }) -join "`n"
    $text = $text -replace '(?i)(--(?:headers|update-headers)\s*[=:]\s*)[^\s,;"]+', '$1<redacted>'
    return $text -replace '(?i)(X-ClashPanel-Scheduler-Secret\s*[=:]\s*)[^\s,;"]+', '$1<redacted>'
}

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $output = @(& gcloud @Args 2>&1)
    if ($LASTEXITCODE -ne 0) {
        $details = Format-SafeGcloudOutput $output
        $message = "gcloud command failed: gcloud $(Format-SafeGcloudArgs $Args)"
        if (-not [string]::IsNullOrWhiteSpace($details)) {
            $message = "$message`n$details"
        }
        throw $message
    }
}

function Run-GcloudQuiet {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $output = @(& gcloud @Args 2>&1)
    if ($LASTEXITCODE -ne 0) {
        $details = Format-SafeGcloudOutput $output
        $message = "gcloud command failed: gcloud $(Format-SafeGcloudArgs $Args)"
        if (-not [string]::IsNullOrWhiteSpace($details)) {
            $message = "$message`n$details"
        }
        throw $message
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
    & gcloud secrets describe $SecretName --project $ProjectId --format="value(name)" 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Add-GeneratedSchedulerSecretVersion {
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
        $schedulerSecret = $null
        $bytes = $null
    }
}

function Get-LatestEnabledSecretVersion {
    $rows = @(& gcloud secrets versions list $SecretName `
        --project $ProjectId `
        --filter="state=ENABLED" `
        --sort-by="~createTime" `
        --limit=1 `
        --format="value(name)" 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list versions for scheduler secret '$SecretName'."
    }

    foreach ($row in $rows) {
        $value = ([string]$row).Trim()
        if ($value -match '/versions/([0-9]+)$') {
            return $Matches[1]
        }
        if ($value -match '^([0-9]+)$') {
            return $Matches[1]
        }
    }
    return $null
}

function Get-SecretVersionValue {
    param([Parameter(Mandatory = $true)][string]$Version)
    $valueLines = @(& gcloud secrets versions access $Version `
        --secret=$SecretName `
        --project=$ProjectId 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not access scheduler secret '$SecretName' version '$Version'."
    }
    $value = ($valueLines | ForEach-Object { [string]$_ }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Scheduler secret '$SecretName' version '$Version' is empty."
    }
    return $value.Trim()
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

$secretExists = Secret-Exists
if (-not $secretExists) {
    Run-Gcloud secrets create $SecretName --project $ProjectId --replication-policy="automatic"
    Add-GeneratedSchedulerSecretVersion
} elseif ($RotateSchedulerSecret) {
    Write-Host "Rotating Phase 8 scheduler secret..." -ForegroundColor Cyan
    Add-GeneratedSchedulerSecretVersion
}

$schedulerVersion = Get-LatestEnabledSecretVersion
if (-not $schedulerVersion) {
    throw "Scheduler secret '$SecretName' has no ENABLED version. Rerun with -RotateSchedulerSecret to add one."
}
$schedulerSecret = Get-SecretVersionValue -Version $schedulerVersion

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
    --update-secrets="ADVANCED_STATS_SCHEDULER_SECRET=${SecretName}:${schedulerVersion}" `
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
Write-Host "  Scheduler secret: isolated Phase 8 Secret Manager secret"
Write-Host "  Preview scheduler job: $SchedulerJobName, every minute, PAUSED"
Write-Host ""
Write-Host "Next: run activate-advanced-stats-phase8.ps1 to enable collection only on the tagged preview revision." -ForegroundColor Yellow
