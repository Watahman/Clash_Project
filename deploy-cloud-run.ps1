param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [switch]$AllowAdvancedStatsCollectionDisabled
)

$ErrorActionPreference = "Stop"

$RuntimeServiceAccount = "clashpanel-api-runtime@$ProjectId.iam.gserviceaccount.com"


function Assert-ProductionGitState {
    $status = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Git status kon niet worden gelezen." }
    if ($status.Count -gt 0) { throw "Production deploy geweigerd: de working tree bevat lokale wijzigingen." }

    git fetch origin master --quiet
    if ($LASTEXITCODE -ne 0) { throw "Production deploy geweigerd: origin/master kon niet worden opgehaald." }
    $head = (git rev-parse HEAD).Trim()
    $productionHead = (git rev-parse origin/master).Trim()
    if ($head -ne $productionHead) {
        throw "Production deploy geweigerd: HEAD ($head) is niet gelijk aan origin/master ($productionHead)."
    }
}

function Get-HttpStatusWithRetry {
    param([Parameter(Mandatory = $true)][string]$Url)
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
            return [int]$response.StatusCode
        } catch {
            if ($attempt -eq 3) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

function Assert-LiveCloudRunDeployment {
    param([Parameter(Mandatory = $true)][string]$RevisionName)
    $service = (& gcloud run services describe $ServiceName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $service) { throw "Post-deploy controle kon Cloud Run service niet lezen." }
    $liveTraffic = @($service.status.traffic) | Where-Object { $_.revisionName -eq $RevisionName -and [int]$_.percent -eq 100 } | Select-Object -First 1
    if (-not $liveTraffic) { throw "Post-deploy controle: revision '$RevisionName' ontvangt niet 100% production traffic." }

    $revision = (& gcloud run revisions describe $RevisionName --project $ProjectId --region $Region --format=json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $revision) { throw "Post-deploy controle kon revision '$RevisionName' niet lezen." }
    if ([string]$revision.spec.serviceAccountName -ne $RuntimeServiceAccount) {
        throw "Post-deploy controle: onverwachte runtime service account op '$RevisionName'."
    }
    if ([string]$revision.metadata.annotations.'run.googleapis.com/cpu-throttling' -ne 'true') {
        throw "Post-deploy controle: CPU throttling staat niet aan op '$RevisionName'."
    }

    $env = @($revision.spec.containers[0].env)
    $secretNames = @($env | Where-Object { $_.valueFrom.secretKeyRef.name } | ForEach-Object { [string]$_.valueFrom.secretKeyRef.name } | Sort-Object -Unique)
    $expectedSecrets = @('ADVANCED_STATS_SCHEDULER_SECRET','API_PROXY_SECRET','SUPABASE_SERVICE_ROLE_KEY')
    if (($secretNames -join ',') -ne ($expectedSecrets -join ',')) {
        throw "Post-deploy controle: onverwachte Secret Manager bindings: $($secretNames -join ', ')."
    }
    foreach ($ordinaryName in @('_API_KEY_SUPABASE','POSTHOG_PROJECT_API_KEY')) {
        $entry = $env | Where-Object { $_.name -eq $ordinaryName } | Select-Object -First 1
        if (-not $entry -or $entry.valueFrom) { throw "Post-deploy controle: $ordinaryName is niet als gewone env var geconfigureerd." }
    }

    $serviceUrl = [string]$service.status.url
    if ((Get-HttpStatusWithRetry "$serviceUrl/health") -ne 200) { throw "Post-deploy controle: /health is niet 200." }
    if ((Get-HttpStatusWithRetry "$serviceUrl/ready") -ne 200) { throw "Post-deploy controle: /ready is niet 200." }
    Write-Host "Post-deploy verificatie geslaagd voor ${RevisionName}: 100% traffic, CPU throttling, 3 secrets, health/ready OK." -ForegroundColor Green
}

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

Assert-ProductionGitState

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
$revisionSuffix = "prod-" + (Get-Date -Format "yyyyMMddHHmmss")
$revisionName = "$ServiceName-$revisionSuffix"

gcloud run deploy $ServiceName `
    --source . `
    --revision-suffix $revisionSuffix `
    --region $Region `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --service-account $RuntimeServiceAccount `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 40 `
    --timeout 120s `
    --cpu-boost `
    --cpu-throttling `
    --env-vars-file ./cloudrun-env.yaml `
    --update-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,API_PROXY_SECRET=API_PROXY_SECRET:latest,ADVANCED_STATS_SCHEDULER_SECRET=ADVANCED_STATS_SCHEDULER_SECRET:latest"

if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deploy is mislukt."
}

gcloud run services update-traffic $ServiceName --project $ProjectId --region $Region --to-revisions="$revisionName=100"
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run revision is deployed, maar production traffic kon niet expliciet naar $revisionName worden gezet."
}

Assert-LiveCloudRunDeployment -RevisionName $revisionName

Write-Host "Deploy klaar. Advanced Stats collection en scheduler blijven uit; start configure-advanced-stats-production.ps1 niet zonder aparte releasebeslissing." -ForegroundColor Green
Write-Host "Secret Manager bindings actief voor: SUPABASE_SERVICE_ROLE_KEY, API_PROXY_SECRET en ADVANCED_STATS_SCHEDULER_SECRET." -ForegroundColor Cyan
Write-Host "_API_KEY_SUPABASE en POSTHOG_PROJECT_API_KEY worden als gewone env vars uit cloudrun-env.yaml geladen." -ForegroundColor Cyan
