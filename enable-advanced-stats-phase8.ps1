param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

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

function Get-ServiceJson {
    $service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) {
        throw "Cloud Run service '$ServiceName' was not found."
    }
    return $service
}

function Get-TaggedCandidateUrl {
    $service = Get-ServiceJson
    $tagTraffic = @($service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    $url = [string]$tagTraffic.url
    if (-not $url) {
        throw "Tagged Cloud Run candidate '$TagName' was not found."
    }
    return $url
}

function Get-HttpResult {
    param(
        [Parameter(Mandatory = $true)] [string]$Url,
        [hashtable]$Headers = @{}
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $Headers -UseBasicParsing -TimeoutSec 30
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = [string]$response.Content }
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $status = [int]$_.Exception.Response.StatusCode
            return [pscustomobject]@{ Status = $status; Body = "" }
        }
        throw
    }
}

$serviceJson = Get-ServiceJson
$candidateUrl = Get-TaggedCandidateUrl
$envEntries = @($serviceJson.spec.template.spec.containers[0].env)

function Get-EnvValue([string]$Name) {
    $entry = $envEntries | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if (-not $entry) { return $null }
    return [string]$entry.value
}

$publicEnrollment = Get-EnvValue "ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED"
$allowlist = Get-EnvValue "ADVANCED_STATS_ROLLOUT_USER_IDS"

if ($publicEnrollment -ne "false") {
    throw "Public enrollment must remain false during the developer stage."
}
if (-not $allowlist) {
    throw "ADVANCED_STATS_ROLLOUT_USER_IDS is empty. Configure the developer-only allowlist first."
}

$allowlistIds = @($allowlist.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($allowlistIds.Count -ne 1) {
    throw "The first Phase 8 stage must contain exactly one developer UUID in ADVANCED_STATS_ROLLOUT_USER_IDS."
}
try {
    [void][Guid]::Parse($allowlistIds[0])
} catch {
    throw "The Phase 8 rollout allowlist does not contain a valid developer UUID."
}

$jobState = (& gcloud scheduler jobs describe $SchedulerJobName --project $ProjectId --location $Region --format="value(state)").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Scheduler job '$SchedulerJobName' was not found. Run configure-advanced-stats-phase8.ps1 first."
}
if ($jobState -ne "PAUSED") {
    throw "Scheduler job must be PAUSED before collection is enabled. Current state: $jobState"
}

$schedulerSecret = (& gcloud secrets versions access latest --secret=$SecretName --project=$ProjectId).Trim()
if ($LASTEXITCODE -ne 0 -or -not $schedulerSecret) {
    throw "Could not access scheduler secret '$SecretName'."
}

Write-Host "Enabling collection only on the zero-traffic Phase 8 candidate..." -ForegroundColor Cyan
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=true,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false" `
    --no-traffic `
    --tag $TagName

$candidateUrl = Get-TaggedCandidateUrl

try {
    $noSecret = Get-HttpResult -Url "$candidateUrl/InternalAdvancedStatsPoll"
    if ($noSecret.Status -ne 401) {
        throw "Internal poll without scheduler secret returned $($noSecret.Status) instead of 401."
    }

    $wrongSecret = Get-HttpResult -Url "$candidateUrl/InternalAdvancedStatsPoll" -Headers @{ "X-ClashPanel-Scheduler-Secret" = "intentionally-wrong-phase8-secret" }
    if ($wrongSecret.Status -ne 401) {
        throw "Internal poll with a wrong scheduler secret returned $($wrongSecret.Status) instead of 401."
    }

    $authorized = Get-HttpResult -Url "$candidateUrl/InternalAdvancedStatsPoll" -Headers @{ "X-ClashPanel-Scheduler-Secret" = $schedulerSecret }
    if ($authorized.Status -ne 200) {
        throw "Authorized internal poll returned $($authorized.Status) instead of 200."
    }

    $summary = $null
    try { $summary = $authorized.Body | ConvertFrom-Json } catch { }
    if ($summary) {
        Write-Host "Authorized collector batch:" -ForegroundColor Green
        Write-Host "  claimed=$($summary.claimed) succeeded=$($summary.succeeded) failed=$($summary.failed)"
        Write-Host "  inserted=$($summary.insertedBattles) duplicates=$($summary.duplicateBattles) parserErrors=$($summary.parserErrors) rateLimited=$($summary.rateLimited)"
    }

    Run-Gcloud scheduler jobs resume $SchedulerJobName --project $ProjectId --location $Region
} catch {
    Write-Warning "Phase 8 enablement failed. Applying kill switch on the tagged candidate."
    & gcloud scheduler jobs pause $SchedulerJobName --project $ProjectId --location $Region | Out-Null
    & gcloud run services update $ServiceName --project $ProjectId --region $Region --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false" --no-traffic --tag $TagName | Out-Null
    throw
} finally {
    $schedulerSecret = $null
}

Write-Host "Phase 8 developer collection is now enabled on the tagged candidate." -ForegroundColor Green
Write-Host "  Normal production traffic to candidate: 0%"
Write-Host "  Public enrollment: OFF"
Write-Host "  Allowlist: exactly one developer UUID"
Write-Host "  Scheduler: ACTIVE every 5 minutes against tagged candidate"
Write-Host ""
Write-Host "Observe real battle-log cycles before expanding the allowlist or moving any production traffic." -ForegroundColor Yellow
