param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll",
    [string]$SecretName = "ADVANCED_STATS_SCHEDULER_SECRET",
    [switch]$RotateSchedulerSecret
)

$ErrorActionPreference = "Stop"

$RuntimeServiceAccount = "clashpanel-api-runtime@$ProjectId.iam.gserviceaccount.com"

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

function Get-ServiceJson {
    $service = (& gcloud run services describe $ServiceName `
        --project $ProjectId `
        --region $Region `
        --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) {
        throw "Cloud Run service '$ServiceName' was not found in $Region."
    }
    return $service
}

function Get-HttpResult {
    param(
        [Parameter(Mandatory = $true)] [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers -UseBasicParsing -TimeoutSec 120
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = [string]$response.Content }
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $status = [int]$_.Exception.Response.StatusCode
            $body = ""
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                $reader.Dispose()
            } catch { }
            return [pscustomobject]@{ Status = $status; Body = $body }
        }
        throw
    }
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

    $generatedSecret = [Convert]::ToBase64String($bytes)
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $generatedSecret, (New-Object System.Text.UTF8Encoding($false)))
        Run-Gcloud secrets versions add $SecretName --project $ProjectId --data-file=$tempFile
    } finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        $generatedSecret = $null
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

function Scheduler-Exists {
    & gcloud scheduler jobs describe $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --format="value(name)" 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

Run-Gcloud config set project $ProjectId
Run-Gcloud services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com

$secretExists = Secret-Exists
if (-not $secretExists) {
    Write-Host "Creating scheduler secret..." -ForegroundColor Cyan
    Run-Gcloud secrets create $SecretName --project $ProjectId --replication-policy="automatic"
    Add-GeneratedSchedulerSecretVersion
} elseif ($RotateSchedulerSecret) {
    Write-Host "Rotating scheduler secret..." -ForegroundColor Cyan
    Add-GeneratedSchedulerSecretVersion
}

$schedulerVersion = Get-LatestEnabledSecretVersion
if (-not $schedulerVersion) {
    throw "Scheduler secret '$SecretName' has no ENABLED version. Rerun with -RotateSchedulerSecret to add one."
}
$schedulerSecret = Get-SecretVersionValue -Version $schedulerVersion

$service = Get-ServiceJson
$serviceAccount = [string]$service.spec.template.spec.serviceAccountName
if (-not $serviceAccount) {
    $projectNumber = (& gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $projectNumber) {
        throw "Could not resolve the Cloud Run service account."
    }
    $serviceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

Run-Gcloud secrets add-iam-policy-binding $SecretName `
    --project $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/secretmanager.secretAccessor"

Write-Host "Enabling the production collector and attaching the scheduler secret..." -ForegroundColor Cyan
Run-Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --service-account $RuntimeServiceAccount `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=true" `
    --update-secrets="ADVANCED_STATS_SCHEDULER_SECRET=${SecretName}:${schedulerVersion}"

$service = Get-ServiceJson
$serviceUrl = [string]$service.status.url
if (-not $serviceUrl) {
    throw "Could not resolve the production Cloud Run service URL."
}
$pollUrl = "$serviceUrl/InternalAdvancedStatsPoll"

if (Scheduler-Exists) {
    Run-Gcloud scheduler jobs update http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="* * * * *" `
        --time-zone="Etc/UTC" `
        --uri=$pollUrl `
        --http-method=POST `
        --update-headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="120s" `
        --max-retry-attempts=0
} else {
    Run-Gcloud scheduler jobs create http $SchedulerJobName `
        --project $ProjectId `
        --location $Region `
        --schedule="* * * * *" `
        --time-zone="Etc/UTC" `
        --uri=$pollUrl `
        --http-method=POST `
        --headers="X-ClashPanel-Scheduler-Secret=$schedulerSecret" `
        --attempt-deadline="120s" `
        --max-retry-attempts=0
}

$jobState = (& gcloud scheduler jobs describe $SchedulerJobName `
    --project $ProjectId `
    --location $Region `
    --format="value(state)").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect scheduler job '$SchedulerJobName'."
}
if ($jobState -eq "PAUSED") {
    Run-Gcloud scheduler jobs resume $SchedulerJobName --project $ProjectId --location $Region
}

# The handler checks the collection switch before the HTTP method. Therefore a
# GET returning 405 is an explicit runtime proof that the collector is enabled.
$methodProbe = Get-HttpResult -Url $pollUrl -Method "GET"
if ($methodProbe.Status -ne 405) {
    throw "Collector runtime probe returned $($methodProbe.Status); expected 405 after enabling collection."
}

Write-Host "Running one authorized collector pass now..." -ForegroundColor Cyan
$authorized = Get-HttpResult -Url $pollUrl -Method "POST" -Headers @{
    "X-ClashPanel-Scheduler-Secret" = $schedulerSecret
}
if ($authorized.Status -ne 200) {
    throw "Authorized collector pass returned $($authorized.Status) instead of 200."
}

$summary = $null
try { $summary = $authorized.Body | ConvertFrom-Json } catch { }
if ($summary) {
    Write-Host "Collector pass succeeded:" -ForegroundColor Green
    Write-Host "  claimed=$($summary.claimed) succeeded=$($summary.succeeded) failed=$($summary.failed)"
    Write-Host "  processed=$($summary.processed) inserted=$($summary.insertedBattles) duplicates=$($summary.duplicateBattles)"
    Write-Host "  partialScopes=$($summary.partialScopes)"
}

Write-Host "Advanced Stats production collection is active." -ForegroundColor Green
Write-Host "  Cloud Run: $serviceUrl"
Write-Host "  Scheduler: every minute"
Write-Host "  Runtime probe: 405 on GET (enabled)"
Write-Host "  Authorized POST: 200"

$schedulerSecret = $null
