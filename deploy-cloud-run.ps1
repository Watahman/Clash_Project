param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [switch]$AllowAdvancedStatsCollectionDisabled
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "./Dockerfile")) {
    throw "Voer dit script uit vanuit de hoofdmap van Clash_Project, waar Dockerfile staat."
}

if (-not (Test-Path "./cloudrun-env.yaml")) {
    throw "Maak eerst cloudrun-env.yaml op basis van cloudrun-env.example.yaml."
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

function Assert-CloudRunEnvConfig {
    param([Parameter(Mandatory = $true)] [string]$Path)

    foreach ($name in @('_API_KEY_SUPABASE', 'POSTHOG_PROJECT_API_KEY')) {
        $value = Get-CloudRunEnvValue -Path $Path -Name $name
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match '(?i)(replace|placeholder|your-project|<[^>]+>)') {
            throw "cloudrun-env.yaml moet een echte $name bevatten; gebruik geen voorbeeld-placeholder."
        }
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
}

Assert-CloudRunEnvConfig -Path "./cloudrun-env.yaml"

function Assert-SecretManagerBindingsExist {
    foreach ($name in @('SUPABASE_SERVICE_ROLE_KEY', 'API_PROXY_SECRET', 'ADVANCED_STATS_SCHEDULER_SECRET')) {
        & gcloud secrets describe $name --project $ProjectId --format="value(name)" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            if ($name -eq 'ADVANCED_STATS_SCHEDULER_SECRET') {
                throw "Secret Manager-secret '$name' ontbreekt. Voer configure-advanced-stats-production.ps1 eerst uit; deploy is geen secretrotatie."
            }
            throw "Vereiste Secret Manager-secret '$name' ontbreekt. Maak of migreer deze bewust voordat je deployt."
        }
    }
}

# A production deploy used to be able to silently copy the old rollout default
# ADVANCED_STATS_COLLECTION_ENABLED=false back into Cloud Run. Existing trackers
# would then stay INITIALIZING forever because /InternalAdvancedStatsPoll returns
# 404 before the scheduler can collect anything. Require an explicit kill-switch
# override when collection is intentionally disabled.
$cloudRunEnv = Get-Content "./cloudrun-env.yaml" -Raw
$collectionEnabled = $cloudRunEnv -match '(?im)^\s*ADVANCED_STATS_COLLECTION_ENABLED\s*:\s*["'']?true["'']?\s*(?:#.*)?$'
if (-not $collectionEnabled -and -not $AllowAdvancedStatsCollectionDisabled) {
    throw "ADVANCED_STATS_COLLECTION_ENABLED moet true zijn voor een normale production deploy. Gebruik -AllowAdvancedStatsCollectionDisabled alleen als bewuste kill switch."
}

$rankedSeasonConfigured = $cloudRunEnv -match '(?im)^\s*CLASHKING_RANKED_SEASON\s*:\s*["'']?[1-9][0-9]*["'']?\s*(?:#.*)?$'
if ($rankedSeasonConfigured) {
    Write-Host "CLASHKING_RANKED_SEASON override gevonden; automatische ClashKing season discovery wordt voor ranked overgeslagen." -ForegroundColor Cyan
} else {
    Write-Host "Ranked season wordt automatisch opgelost via ClashKing V2 /v2/dates/current." -ForegroundColor Cyan
}

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
Assert-SecretManagerBindingsExist

# The same project key is used by Development and Production; the
# environment label in cloudrun-env.yaml keeps their events separate.
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 40 `
    --timeout 120s `
    --cpu-boost `
    --no-cpu-throttling `
    --env-vars-file ./cloudrun-env.yaml `
    --update-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,API_PROXY_SECRET=API_PROXY_SECRET:latest,ADVANCED_STATS_SCHEDULER_SECRET=ADVANCED_STATS_SCHEDULER_SECRET:latest"

if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deploy is mislukt."
}

Write-Host "Deploy klaar. Advanced Stats collection en scheduler blijven uit; start configure-advanced-stats-production.ps1 niet zonder aparte releasebeslissing." -ForegroundColor Green
Write-Host "Secret Manager bindings actief voor: SUPABASE_SERVICE_ROLE_KEY, API_PROXY_SECRET en ADVANCED_STATS_SCHEDULER_SECRET." -ForegroundColor Cyan
Write-Host "_API_KEY_SUPABASE en POSTHOG_PROJECT_API_KEY worden als gewone env vars uit cloudrun-env.yaml geladen." -ForegroundColor Cyan
