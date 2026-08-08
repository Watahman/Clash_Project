param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8",
    [string]$ProxyEnvName = "API_PROXY_SECRET",
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

function Get-TaggedCandidateUrl {
    param([Parameter(Mandatory = $true)]$Service)
    $tagTraffic = @($Service.status.traffic) | Where-Object { $_.tag -eq $TagName } | Select-Object -First 1
    $url = [string]$tagTraffic.url
    if (-not $url) {
        throw "Tagged Cloud Run candidate '$TagName' was not found. Run deploy-cloud-run-phase8.ps1 first."
    }
    return $url
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

$serviceJsonRaw = (& $gcloudExecutable run services describe $ServiceName --project=$ProjectId --region=$Region --format=json)
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect Cloud Run service '$ServiceName' in $Region."
}
$service = ($serviceJsonRaw -join "`n") | ConvertFrom-Json
if (-not $service) {
    throw "Cloud Run returned an empty service description."
}

$candidateUrl = Get-TaggedCandidateUrl -Service $service
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
        Write-Host "  Existing proxy credential: resolved without guessing its Secret Manager name"
        Write-Host "  Local Wrangler: available and authenticated"
        Write-Host "  Frontend build: passed"
        Write-Host "  Wrangler config/bundle dry-run: passed"
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
Write-Host "  Custom-domain route: none"
Write-Host "  Cron trigger: none"
Write-Host "  Upstream CORS origin: https://clashpanel.com (preview Worker only)"
Write-Host "  Production clashpanel.com: unchanged"
Write-Host ""
Write-Host "Use the workers.dev URL printed by Wrangler to sign in and open /app/advanced-stats."
Write-Host "For this preview, prefer normal email/password sign-in; the production Google OAuth callback still points to clashpanel.com."
