param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$ProxyEnvName = "API_PROXY_SECRET",
    [string]$PreviewOrigin = "",
    [switch]$AllowEnabledCollection,
    [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found on PATH."
    }
    return $command.Source
}

function Run-NativeChecked {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }
}

function Get-ServiceJson {
    param([Parameter(Mandatory = $true)][string]$GcloudExecutable)

    $serviceJsonRaw = (& $GcloudExecutable run services describe $ServiceName --project=$ProjectId --region=$Region --format=json)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect Cloud Run service '$ServiceName' in $Region."
    }

    $service = ($serviceJsonRaw -join "`n") | ConvertFrom-Json
    if (-not $service) {
        throw "Cloud Run returned an empty service description."
    }
    return $service
}

function Get-TaggedCandidateUrl {
    param([Parameter(Mandatory = $true)]$Service)
    $tagTraffic = @($Service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    $url = [string]$tagTraffic.url
    if (-not $url) {
        throw "Tagged Cloud Run candidate '$TagName' was not found. Run deploy-cloud-run-phase8.ps1 first."
    }
    return $url
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)]$Service,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $containers = @($Service.spec.template.spec.containers)
    if ($containers.Count -lt 1) { return $null }
    $entry = @($containers[0].env) | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if (-not $entry) { return $null }
    return [string]$entry.value
}

function Assert-Phase8StillSafe {
    param([Parameter(Mandatory = $true)]$Service)

    $tagTraffic = @($Service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    $tagPercent = 0
    if ($null -ne $tagTraffic.percent -and [string]$tagTraffic.percent -ne "") {
        $tagPercent = [int]$tagTraffic.percent
    }
    if ($tagPercent -ne 0) {
        throw "Phase 8 safety check failed: tagged candidate has $tagPercent% normal production traffic."
    }

    $collection = Get-EnvValue -Service $Service -Name "ADVANCED_STATS_COLLECTION_ENABLED"
    $publicEnrollment = Get-EnvValue -Service $Service -Name "ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED"
    if ($publicEnrollment -ne "false") {
        throw "Phase 8 safety check failed: ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED must still be false before preview auth setup."
    }
    if ($collection -eq "false") { return }
    if ($collection -ne "true" -or -not $AllowEnabledCollection) {
        throw "Phase 8 safety check failed: enabled collection requires -AllowEnabledCollection."
    }

    $allowlist = Get-EnvValue -Service $Service -Name "ADVANCED_STATS_ROLLOUT_USER_IDS"
    $allowlistIds = @([string]$allowlist -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($allowlistIds.Count -ne 1) {
        throw "Phase 8 safety check failed: enabled collection must remain limited to one developer UUID."
    }
    try { [void][Guid]::Parse($allowlistIds[0]) } catch {
        throw "Phase 8 safety check failed: rollout allowlist is not a valid developer UUID."
    }

    $containers = @($Service.spec.template.spec.containers)
    $schedulerSecret = @($containers[0].env) |
        Where-Object { $_.name -eq "ADVANCED_STATS_SCHEDULER_SECRET" } |
        Select-Object -First 1
    if (-not $schedulerSecret.valueFrom.secretKeyRef.name) {
        throw "Phase 8 safety check failed: enabled collection has no Scheduler Secret Manager binding."
    }
}

function Normalize-PreviewOrigin {
    param([Parameter(Mandatory = $true)][string]$Origin)

    $trimmed = $Origin.Trim().TrimEnd('/')
    try {
        $uri = [Uri]$trimmed
    } catch {
        throw "PreviewOrigin must be an absolute HTTPS workers.dev origin."
    }

    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne "https" -or -not $uri.Host.EndsWith(".workers.dev", [StringComparison]::OrdinalIgnoreCase)) {
        throw "PreviewOrigin must be an absolute HTTPS workers.dev origin, for example https://clashpanel-phase8-preview.example.workers.dev"
    }
    if ($uri.AbsolutePath -ne "/" -or -not [string]::IsNullOrEmpty($uri.Query) -or -not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw "PreviewOrigin must contain only scheme + host, without a path, query or fragment."
    }

    return $trimmed
}

function Get-ProxySecretValue {
    param(
        [Parameter(Mandatory = $true)]$Service,
        [Parameter(Mandatory = $true)][string]$GcloudExecutable
    )

    $containers = @($Service.spec.template.spec.containers)
    if ($containers.Count -lt 1) {
        throw "Cloud Run service '$ServiceName' has no container configuration."
    }

    $envEntry = @($containers[0].env) |
        Where-Object { $_.name -eq $ProxyEnvName } |
        Select-Object -First 1

    if (-not $envEntry) {
        throw "Cloud Run does not expose '$ProxyEnvName' in the current service template. The preview will not guess a secret name."
    }

    if ($null -ne $envEntry.value -and -not [string]::IsNullOrWhiteSpace([string]$envEntry.value)) {
        Write-Host "Resolved proxy credential from the existing Cloud Run environment binding." -ForegroundColor DarkGray
        return [string]$envEntry.value
    }

    $secretRef = $envEntry.valueFrom.secretKeyRef
    if (-not $secretRef -or [string]::IsNullOrWhiteSpace([string]$secretRef.name)) {
        throw "Cloud Run '$ProxyEnvName' exists but has neither a plain value nor a Secret Manager reference."
    }

    $secretName = [string]$secretRef.name
    $secretVersion = [string]$secretRef.key
    if ([string]::IsNullOrWhiteSpace($secretVersion)) {
        $secretVersion = "latest"
    }

    Write-Host "Resolved '$ProxyEnvName' from existing Cloud Run Secret Manager binding '$secretName' (value remains hidden)." -ForegroundColor DarkGray
    $value = (& $GcloudExecutable secrets versions access $secretVersion --secret=$secretName --project=$ProjectId)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read the Secret Manager version currently bound to Cloud Run for '$ProxyEnvName'."
    }

    $joined = (($value | ForEach-Object { [string]$_ }) -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($joined)) {
        throw "The Cloud Run-bound '$ProxyEnvName' secret resolved to an empty value."
    }
    return $joined
}

if (-not (Test-Path "./wrangler.phase8-preview.jsonc")) {
    throw "wrangler.phase8-preview.jsonc is missing."
}
if (-not (Test-Path "./package.json")) {
    throw "Run this script from the Clash_Project root."
}
if (-not (Test-Path "./worker/index.js")) {
    throw "worker/index.js is missing."
}

$normalizedPreviewOrigin = ""
if (-not [string]::IsNullOrWhiteSpace($PreviewOrigin)) {
    $normalizedPreviewOrigin = Normalize-PreviewOrigin -Origin $PreviewOrigin
}
if (-not $PreflightOnly -and [string]::IsNullOrWhiteSpace($normalizedPreviewOrigin)) {
    throw "A real Phase 8 preview deploy requires -PreviewOrigin so Google OAuth cannot fall back to clashpanel.com."
}

$nodeExecutable = Require-Command "node.exe"
$npmExecutable = Require-Command "npm.cmd"
$gcloudExecutable = Require-Command "gcloud.cmd"

$wranglerExecutable = Join-Path (Get-Location) "node_modules\.bin\wrangler.cmd"
if (-not (Test-Path $wranglerExecutable)) {
    throw "Local Wrangler is missing at node_modules\.bin\wrangler.cmd. Run 'npm install' first; the Phase 8 script will not download or substitute a different Wrangler version automatically."
}

Write-Host "Checking local Phase 8 preview tooling..." -ForegroundColor Cyan
Run-NativeChecked -Executable $nodeExecutable -Arguments @("--version") -FailureMessage "Node.js check failed"
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("--version") -FailureMessage "Local Wrangler check failed"
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("whoami") -FailureMessage "Cloudflare authentication check failed. Run 'npx wrangler login' and retry"

$service = Get-ServiceJson -GcloudExecutable $gcloudExecutable
Assert-Phase8StillSafe -Service $service
$candidateUrl = Get-TaggedCandidateUrl -Service $service

if (-not $PreflightOnly) {
    $previewCallback = "$normalizedPreviewOrigin/api/AuthGoogleCallback"
    $configuredCallback = Get-EnvValue -Service $service -Name "AUTH_GOOGLE_CALLBACK_URL"
    if ($configuredCallback -ne $previewCallback) {
        Write-Host "Binding Google OAuth callback to the isolated Phase 8 preview..." -ForegroundColor Cyan
        Run-NativeChecked `
            -Executable $gcloudExecutable `
            -Arguments @(
                "run", "services", "update", $ServiceName,
                "--project=$ProjectId",
                "--region=$Region",
                "--update-env-vars=AUTH_GOOGLE_CALLBACK_URL=$previewCallback",
                "--no-traffic",
                "--tag=$TagName"
            ) `
            -FailureMessage "Could not bind the Phase 8 Google OAuth callback to the workers.dev preview"

        $service = Get-ServiceJson -GcloudExecutable $gcloudExecutable
        Assert-Phase8StillSafe -Service $service
        $candidateUrl = Get-TaggedCandidateUrl -Service $service
        $configuredCallback = Get-EnvValue -Service $service -Name "AUTH_GOOGLE_CALLBACK_URL"
    }
    if ($configuredCallback -ne $previewCallback) {
        throw "Phase 8 callback verification failed: Cloud Run did not retain the expected workers.dev callback URL."
    }
}

$proxySecret = Get-ProxySecretValue -Service $service -GcloudExecutable $gcloudExecutable

Write-Host "Building the current Advanced Stats candidate locally..." -ForegroundColor Cyan
Run-NativeChecked -Executable $npmExecutable -Arguments @("run", "build") -FailureMessage "Frontend build failed"

if (-not (Test-Path "./dist")) {
    throw "Frontend build completed without creating the dist directory."
}

$templateConfig = Get-Content "./wrangler.phase8-preview.jsonc" -Raw
if ($templateConfig -notmatch "__PHASE8_CANDIDATE_URL__") {
    throw "wrangler.phase8-preview.jsonc is missing the Phase 8 candidate URL placeholder."
}

$generatedConfigPath = Join-Path (Get-Location) ".wrangler.phase8-preview.generated.jsonc"
$generatedConfig = $templateConfig.Replace("__PHASE8_CANDIDATE_URL__", $candidateUrl)
[System.IO.File]::WriteAllText($generatedConfigPath, $generatedConfig, (New-Object System.Text.UTF8Encoding($false)))

$tempSecretsFile = Join-Path ([System.IO.Path]::GetTempPath()) ("clashpanel-phase8-secrets-" + [Guid]::NewGuid().ToString("N") + ".json")
try {
    $secretJson = @{ API_PROXY_SECRET = $proxySecret } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($tempSecretsFile, $secretJson, (New-Object System.Text.UTF8Encoding($false)))

    if ($PreflightOnly) {
        Write-Host "Validating Wrangler config/bundle without uploading..." -ForegroundColor Cyan
        Run-NativeChecked `
            -Executable $wranglerExecutable `
            -Arguments @("deploy", "--dry-run", "--config", $generatedConfigPath, "--secrets-file", $tempSecretsFile) `
            -FailureMessage "Wrangler Phase 8 dry-run validation failed"

        Write-Host "Phase 8 preview preflight passed." -ForegroundColor Green
        Write-Host "  Tagged backend candidate: found"
        Write-Host "  Normal production traffic: unchanged"
        Write-Host "  Public enrollment: still OFF"
        Write-Host "  Collection: $((Get-EnvValue -Service $service -Name 'ADVANCED_STATS_COLLECTION_ENABLED').ToUpperInvariant())"
        Write-Host "  Existing proxy credential: resolved without guessing its Secret Manager name"
        Write-Host "  Local Wrangler: available and authenticated"
        Write-Host "  Frontend build: passed"
        Write-Host "  Wrangler config/bundle dry-run: passed"
        if ($normalizedPreviewOrigin) {
            Write-Host "  Preview origin format: valid ($normalizedPreviewOrigin)"
            Write-Host "  Google OAuth callback change: NOT performed in preflight"
        }
        Write-Host "  Cloudflare deploy: NOT performed (-PreflightOnly)"
        return
    }

    Write-Host "Deploying isolated workers.dev preview against $candidateUrl ..." -ForegroundColor Cyan
    Run-NativeChecked `
        -Executable $wranglerExecutable `
        -Arguments @("deploy", "--config", $generatedConfigPath, "--secrets-file", $tempSecretsFile) `
        -FailureMessage "Cloudflare Phase 8 preview deployment failed"
} finally {
    Remove-Item $tempSecretsFile -Force -ErrorAction SilentlyContinue
    Remove-Item $generatedConfigPath -Force -ErrorAction SilentlyContinue
    $proxySecret = $null
}

if ($PreflightOnly) {
    exit 0
}

Write-Host "Phase 8 frontend preview deployed." -ForegroundColor Green
Write-Host "  Backend target: tagged '$TagName' Cloud Run candidate"
Write-Host "  Normal production traffic to candidate: 0%"
Write-Host "  Preview Worker: separate workers.dev Worker"
Write-Host "  Preview origin: $normalizedPreviewOrigin"
Write-Host "  Google OAuth callback: $normalizedPreviewOrigin/api/AuthGoogleCallback"
Write-Host "  Collection: $((Get-EnvValue -Service $service -Name 'ADVANCED_STATS_COLLECTION_ENABLED').ToUpperInvariant())"
Write-Host "  Public enrollment: OFF"
Write-Host "  Custom-domain route: none"
Write-Host "  Cron trigger: none"
Write-Host "  Upstream CORS origin: https://clashpanel.com (preview Worker only)"
Write-Host "  Production clashpanel.com: unchanged"
Write-Host ""
Write-Host "Before Google sign-in, make sure this exact callback is present in Supabase Authentication > URL Configuration > Redirect URLs:"
Write-Host "  $normalizedPreviewOrigin/api/AuthGoogleCallback" -ForegroundColor Yellow
Write-Host "Then open $normalizedPreviewOrigin/app/advanced-stats and sign in with Google."
