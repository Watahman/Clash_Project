param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [Guid]$DeveloperUserId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll-phase8",
    [string]$SecretName = "ADVANCED_STATS_SCHEDULER_SECRET"
)

$ErrorActionPreference = "Stop"

$RuntimeServiceAccount = "clashpanel-api-runtime@$ProjectId.iam.gserviceaccount.com"

if ($SecretName -ne "ADVANCED_STATS_SCHEDULER_SECRET") {
    throw "Phase 8 must reuse ADVANCED_STATS_SCHEDULER_SECRET; separate preview secrets are not supported."
}

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

if (-not (Secret-Exists)) {
    throw "Shared scheduler secret '$SecretName' does not exist. Configure production Advanced Stats first."
}
$schedulerSecret = (& gcloud secrets versions access latest --secret=$SecretName --project=$ProjectId).Trim()
if ($LASTEXITCODE -ne 0 -or -not $schedulerSecret) {
    throw "Could not access shared scheduler secret '$SecretName'."
}

# Create a new tagged candidate revision, still with 0% normal production traffic.
# Collection intentionally remains disabled until activate-advanced-stats-phase8.ps1 is run.
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --service-account $RuntimeServiceAccount `
    --update-env-vars="ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false,ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_ROLLOUT_USER_IDS=$DeveloperUserId" `
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
Write-Host "  Scheduler secret: shared production-parity ADVANCED_STATS_SCHEDULER_SECRET"
Write-Host "  Preview scheduler job: $SchedulerJobName, every minute, PAUSED"
Write-Host ""
Write-Host "Next: run activate-advanced-stats-phase8.ps1 to enable collection only on the tagged preview revision." -ForegroundColor Yellow
