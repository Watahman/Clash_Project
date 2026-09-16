param(
    [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { throw "Required command '$Name' was not found on PATH." }
    return $command.Source
}

function Run-NativeChecked {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$FailureMessage (exit code $LASTEXITCODE)." }
}

function Assert-ProductionGitState {
    $status = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Git status could not be read." }
    if ($status.Count -gt 0) { throw "Cloudflare production deploy refused: working tree contains local changes." }
    git fetch origin master --quiet
    if ($LASTEXITCODE -ne 0) { throw "origin/master could not be fetched." }
    $head = (git rev-parse HEAD).Trim()
    $master = (git rev-parse origin/master).Trim()
    if ($head -ne $master) {
        throw "Cloudflare production deploy refused: HEAD ($head) does not match origin/master ($master)."
    }
}

function Assert-WranglerProductionConfig {
    $configText = Get-Content "./wrangler.jsonc" -Raw
    $config = $configText | ConvertFrom-Json
    if ([string]$config.name -ne "clashpanel") { throw "wrangler.jsonc Worker name must be 'clashpanel'." }
    if ([bool]$config.workers_dev) { throw "Production Worker must keep workers_dev=false." }
    if ([bool]$config.preview_urls) { throw "Production Worker must keep preview_urls=false." }
    $route = @($config.routes) | Where-Object { $_.pattern -eq "clashpanel.com" -and $_.custom_domain -eq $true } | Select-Object -First 1
    if (-not $route) { throw "Production Worker must use clashpanel.com as a custom domain." }
    if (@($config.triggers.crons).Count -ne 0) { throw "Production Worker deploy refused: cron triggers are configured." }
    $origin = [string]$config.vars.CLOUD_RUN_ORIGIN
    if ($origin -notmatch '^https://.+\.run\.app/?$' -or $origin -match 'phase8') {
        throw "Production CLOUD_RUN_ORIGIN is not a production Cloud Run origin."
    }
}

function Get-HttpStatusWithRetry {
    param([Parameter(Mandatory = $true)][string]$Url)
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try { return [int](Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20).StatusCode }
        catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds 2 }
    }
}
if (-not (Test-Path "./package.json") -or -not (Test-Path "./wrangler.jsonc") -or -not (Test-Path "./worker/index.js")) {
    throw "Run this script from the Clash_Project root."
}

Assert-ProductionGitState
Assert-WranglerProductionConfig

$npmExecutable = Require-Command "npm.cmd"
$wranglerExecutable = Join-Path (Get-Location) "node_modules\.bin\wrangler.cmd"
if (-not (Test-Path $wranglerExecutable)) {
    throw "Local Wrangler is missing. Run 'npm install' first."
}

Write-Host "Checking Cloudflare production tooling..." -ForegroundColor Cyan
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("--version") -FailureMessage "Local Wrangler check failed"
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("whoami") -FailureMessage "Cloudflare authentication check failed"

$secretOutput = @(& $wranglerExecutable secret list --config ./wrangler.jsonc 2>&1)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect production Worker secrets." }
$secrets = (($secretOutput | ForEach-Object { [string]$_ }) -join "`n") | ConvertFrom-Json
if (-not (@($secrets) | Where-Object { $_.name -eq "API_PROXY_SECRET" })) {
    throw "Production Worker secret API_PROXY_SECRET is missing."
}

Write-Host "Running full repository verification before production frontend deploy..." -ForegroundColor Cyan
Run-NativeChecked -Executable $npmExecutable -Arguments @("run", "check") -FailureMessage "Repository verification failed"
Write-Host "Validating the production Worker bundle without uploading..." -ForegroundColor Cyan
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("deploy", "--dry-run", "--config", "./wrangler.jsonc") -FailureMessage "Wrangler production dry-run failed"
if ($PreflightOnly) {
    Write-Host "Cloudflare production preflight passed; nothing uploaded." -ForegroundColor Green
    return
}

Write-Host "Deploying production Worker to clashpanel.com..." -ForegroundColor Cyan
Run-NativeChecked -Executable $wranglerExecutable -Arguments @("deploy", "--config", "./wrangler.jsonc") -FailureMessage "Cloudflare production deploy failed"

foreach ($url in @(
    "https://clashpanel.com/",
    "https://clashpanel.com/robots.txt",
    "https://clashpanel.com/api/health",
    "https://clashpanel.com/api/ready"
)) {
    $status = Get-HttpStatusWithRetry -Url $url
    if ($status -ne 200) { throw "Post-deploy smoke test failed for $url with HTTP $status." }
}

Write-Host "Cloudflare production deploy verified: root, robots, API health and API ready are all HTTP 200." -ForegroundColor Green
Write-Host "Cron triggers remain empty and API_PROXY_SECRET remains a Worker secret." -ForegroundColor Cyan
