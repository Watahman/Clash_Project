param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll-phase8"
)

$ErrorActionPreference = "Stop"

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $($Args -join ' ')"
    }
}

function Get-Phase8Traffic {
    $service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) {
        throw "Cloud Run service '$ServiceName' was not found in $Region."
    }

    $tagTraffic = @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    if (-not $tagTraffic) {
        throw "Tagged Cloud Run candidate '$TagName' was not found. Run deploy-cloud-run-phase8.ps1 first."
    }

    $percent = 0
    if ($null -ne $tagTraffic.percent -and [string]$tagTraffic.percent -ne "") {
        $percent = [int]$tagTraffic.percent
    }

    [pscustomobject]@{
        Url = [string]$tagTraffic.url
        Percent = $percent
    }
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

Run-Gcloud config set project $ProjectId

$before = Get-Phase8Traffic
if (-not $before.Url) {
    throw "Could not resolve the Phase 8 tagged URL."
}
if ($before.Percent -ne 0) {
    throw "Safety gate failed: Phase 8 currently receives $($before.Percent)% normal production traffic. Expected 0%."
}

$jobState = Get-SchedulerJobState
if (-not $jobState) {
    throw "Preview scheduler '$SchedulerJobName' does not exist. Run configure-advanced-stats-phase8.ps1 first."
}

Write-Host "Enabling Advanced Stats collection on the zero-traffic Phase 8 revision..." -ForegroundColor Cyan
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=true,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false" `
    --no-traffic `
    --tag $TagName

$after = Get-Phase8Traffic
if (-not $after.Url) {
    throw "Could not resolve the activated Phase 8 tagged URL."
}
if ($after.Percent -ne 0) {
    throw "Safety gate failed after activation: Phase 8 unexpectedly receives $($after.Percent)% normal production traffic."
}

# Updating the Cloud Run service creates a new tagged revision URL. Keep the isolated
# preview scheduler pointed at that exact revision.
Run-Gcloud scheduler jobs update http $SchedulerJobName `
    --project $ProjectId `
    --location $Region `
    --uri="$($after.Url)/InternalAdvancedStatsPoll" `
    --http-method=POST `
    --schedule="* * * * *" `
    --time-zone="Etc/UTC" `
    --attempt-deadline="120s" `
    --max-retry-attempts=0

$jobState = Get-SchedulerJobState
if ($jobState -eq "PAUSED") {
    Run-Gcloud scheduler jobs resume $SchedulerJobName --project $ProjectId --location $Region
}

# With collection enabled, an unauthenticated GET must reach the handler and be
# rejected as a method/auth request rather than looking like a disabled 404 route.
$routeStatus = Get-HttpStatus -Url "$($after.Url)/InternalAdvancedStatsPoll" -Method "GET"
if ($routeStatus -eq 404) {
    throw "Phase 8 collector route still returns 404. Collection is not active on the tagged revision."
}

# Trigger one immediate preview collection instead of waiting for the next minute.
Run-Gcloud scheduler jobs run $SchedulerJobName --project $ProjectId --location $Region

Write-Host "Phase 8 Advanced Stats collection is active." -ForegroundColor Green
Write-Host "  Tagged preview URL: $($after.Url)"
Write-Host "  Normal production traffic to preview revision: 0%"
Write-Host "  Public enrollment: OFF"
Write-Host "  Collection: ON"
Write-Host "  Preview scheduler: $SchedulerJobName"
Write-Host "  Schedule: every minute"
Write-Host "  Immediate collection run: requested"
Write-Host ""
Write-Host "Reload Historical Analysis and watch AdvancedStatsTrackingGet. lastPollAt and processed counts should start changing shortly." -ForegroundColor Yellow
