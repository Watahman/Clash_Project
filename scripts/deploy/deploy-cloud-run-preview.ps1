param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [Parameter(Mandatory = $true)]
    [string]$PreviewOrigin
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $ProjectRoot

$RuntimeServiceAccount = "clashpanel-api-runtime@$ProjectId.iam.gserviceaccount.com"

try { $previewUri = [Uri]$PreviewOrigin } catch { throw "PreviewOrigin must be an absolute HTTPS workers.dev origin." }
if (-not $previewUri.IsAbsoluteUri -or $previewUri.Scheme -ne "https" -or -not $previewUri.Host.EndsWith(".workers.dev", [StringComparison]::OrdinalIgnoreCase)) {
    throw "PreviewOrigin must be an absolute HTTPS workers.dev origin."
}
$NormalizedPreviewOrigin = $PreviewOrigin.TrimEnd('/')
$PreviewLoginUrl = "$NormalizedPreviewOrigin/subpages/login.html"
$PreviewCallbackUrl = "$NormalizedPreviewOrigin/api/AuthGoogleCallback"


function Assert-PreviewGitState {
    $status = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Git status could not be read." }
    if ($status.Count -gt 0) { throw "Preview deploy refused: the working tree contains local changes." }

    git fetch origin Development --quiet
    if ($LASTEXITCODE -ne 0) { throw "Preview deploy refused: origin/Development could not be fetched." }
    $head = (git rev-parse HEAD).Trim()
    $developmentHead = (git rev-parse origin/Development).Trim()
    if ($head -ne $developmentHead) {
        throw "Preview deploy refused: HEAD ($head) does not match origin/Development ($developmentHead)."
    }
}

function Assert-PreviewRuntimeParity {
    param([Parameter(Mandatory = $true)][string]$RevisionName)
    $revision = (& gcloud run revisions describe $RevisionName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $revision) { throw "Could not inspect preview revision '$RevisionName'." }
    if ([string]$revision.spec.serviceAccountName -ne $RuntimeServiceAccount) {
        throw "Preview parity check failed: unexpected runtime service account."
    }
    if ([string]$revision.metadata.annotations.'run.googleapis.com/cpu-throttling' -ne 'true') {
        throw "Preview parity check failed: CPU throttling is not enabled."
    }
    $env = @($revision.spec.containers[0].env)
    $secretNames = @($env | Where-Object { $_.valueFrom.secretKeyRef.name } | ForEach-Object { [string]$_.valueFrom.secretKeyRef.name } | Sort-Object -Unique)
    $expectedSecrets = @('ADVANCED_STATS_SCHEDULER_SECRET','API_PROXY_SECRET','SUPABASE_SERVICE_ROLE_KEY')
    if (($secretNames -join ',') -ne ($expectedSecrets -join ',')) {
        throw "Preview parity check failed: unexpected Secret Manager bindings: $($secretNames -join ', ')."
    }
    foreach ($ordinaryName in @('_API_KEY_SUPABASE','POSTHOG_PROJECT_API_KEY')) {
        $entry = $env | Where-Object { $_.name -eq $ordinaryName } | Select-Object -First 1
        if (-not $entry -or $entry.valueFrom) { throw "Preview parity check failed: $ordinaryName is not a normal env var." }
    }
    $collection = $env | Where-Object { $_.name -eq 'ADVANCED_STATS_COLLECTION_ENABLED' } | Select-Object -First 1
    if ([string]$collection.value -ne 'false') { throw "Preview parity check failed: Advanced Stats collection is not OFF." }
    $callback = $env | Where-Object { $_.name -eq 'AUTH_GOOGLE_CALLBACK_URL' } | Select-Object -First 1
    if ([string]$callback.value -ne $PreviewCallbackUrl) { throw "Preview parity check failed: Google callback is not bound to the preview origin." }
}

function Format-GcloudArgsForError {
    param([Parameter(Mandatory = $true)][string[]]$Args)

    $safeArgs = @()
    foreach ($arg in $Args) {
        if ($arg -match '^--update-env-vars=') {
            $safeArgs += ($arg -replace '(?i)(_API_KEY_SUPABASE|POSTHOG_PROJECT_API_KEY)=[^,]+', '$1=<redacted>')
        } else {
            $safeArgs += $arg
        }
    }
    return ($safeArgs -join ' ')
}

function Run-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $(Format-GcloudArgsForError -Args $Args)"
    }
}

function Get-CloudRunEnvValue {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    $pattern = '^\s*' + [regex]::Escape($Name) + '\s*:\s*(.+?)\s*(?:#.*)?$'
    foreach ($line in Get-Content $Path) {
        if ($line -match $pattern) {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2 -and (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value.Trim()
        }
    }
    return $null
}

function Get-CloudRunOrdinaryEnv {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $values = @{}
    foreach ($name in @('_API_KEY_SUPABASE', 'POSTHOG_PROJECT_API_KEY')) {
        $value = Get-CloudRunEnvValue -Path $Path -Name $name
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match '(?i)(replace|placeholder|your-project|<[^>]+>)') {
            throw "cloudrun-env.yaml moet een echte $name bevatten; gebruik geen voorbeeld-placeholder."
        }
        $values[$name] = $value
    }

    $secretNames = @(
        'SUPABASE_SERVICE_ROLE_KEY', 'API_PROXY_SECRET',
        'ADVANCED_STATS_SCHEDULER_SECRET', '_API_KEY_SECR_SUPABASE',
        'CLASH_API_KEY_POOL', '_API_KEY_ALL', '_API_KEY_ALL2', '_API_KEY_ALL3'
    )
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:') {
            if ($secretNames -contains $Matches[1]) {
                throw "$($Matches[1]) hoort niet als waarde in cloudrun-env.yaml te staan; koppel deze via Secret Manager."
            }
        }
    }
    return $values
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

if (-not (Test-Path "./Dockerfile")) {
    throw "Run this script from the Clash_Project root where Dockerfile exists."
}

if (-not (Test-Path "./cloudrun-env.yaml")) {
    throw "Create cloudrun-env.yaml from cloudrun-env.example.yaml before deploying."
}

Assert-PreviewGitState

$ordinaryEnv = Get-CloudRunOrdinaryEnv -Path "./cloudrun-env.yaml"
$ordinaryEnvArgs = "_API_KEY_SUPABASE=$($ordinaryEnv['_API_KEY_SUPABASE']),POSTHOG_PROJECT_API_KEY=$($ordinaryEnv['POSTHOG_PROJECT_API_KEY'])"

Write-Host "Preparing zero-traffic preview candidate..." -ForegroundColor Cyan
Run-Gcloud config set project $ProjectId
Run-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

Write-Host "Deploying a zero-traffic preview with production-parity secrets and collection OFF..." -ForegroundColor Cyan

Run-Gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --memory 512Mi `
    --cpu 1 `
    --service-account $RuntimeServiceAccount `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 40 `
    --timeout 120s `
    --cpu-boost `
    --cpu-throttling `
    --update-env-vars="$ordinaryEnvArgs,ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false,POSTHOG_ENABLED=true,POSTHOG_HOST=https://eu.i.posthog.com,CLASHPANEL_ENVIRONMENT=development,AUTH_GOOGLE_CALLBACK_URL=$PreviewCallbackUrl,AUTH_EMAIL_CONFIRM_REDIRECT_URL=$PreviewLoginUrl,AUTH_PASSWORD_RESET_REDIRECT_URL=$PreviewLoginUrl" `
    --remove-env-vars="ADVANCED_STATS_ROLLOUT_USER_IDS,POSTHOG_INTERNAL_USER_IDS" `
    --update-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,API_PROXY_SECRET=API_PROXY_SECRET:latest,ADVANCED_STATS_SCHEDULER_SECRET=ADVANCED_STATS_SCHEDULER_SECRET:latest" `
    --remove-secrets="_API_KEY_SUPABASE,POSTHOG_PROJECT_API_KEY,_API_KEY_SECR_SUPABASE,CLASH_API_KEY_POOL,_API_KEY_ALL,_API_KEY_ALL2,_API_KEY_ALL3" `
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

Assert-PreviewRuntimeParity -RevisionName ([string]$tagTraffic.revisionName)

$health = Get-HttpStatus -Url "$candidateUrl/health"
$ready = Get-HttpStatus -Url "$candidateUrl/ready"
$disabledPoll = Get-HttpStatus -Url "$candidateUrl/InternalAdvancedStatsPoll" -Method "POST"
if ($health -ne 200) { throw "/health returned $health instead of 200 on the tagged candidate." }
if ($ready -ne 200) { throw "/ready returned $ready instead of 200 on the tagged candidate." }
if ($disabledPoll -ne 404) {
    throw "/InternalAdvancedStatsPoll POST returned $disabledPoll instead of 404 while collection is disabled."
}

Write-Host "Preview deployed." -ForegroundColor Green
Write-Host "  Tagged candidate URL: $candidateUrl"
Write-Host "  Production traffic to candidate: 0%"
Write-Host "  Secret Manager bindings: same three as production"
Write-Host "  Collection: OFF"
Write-Host "  Public enrollment: OFF"
Write-Host "  CPU billing: request-based"