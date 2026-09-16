param(
    [string]$ProjectId = "clashpanel",
    [string]$Region = "europe-west1"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Run-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Args -join ' ')"
    }
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "Development") {
    throw "Production promotion must be run from Development. Current branch: $branch"
}

if (@(git status --porcelain).Count -gt 0) {
    throw "Working tree is not clean. Run .\deploy-dev.ps1 first so the exact tested Development commit is pushed before production."
}

Run-Git fetch origin Development master --prune --quiet
$head = (git rev-parse HEAD).Trim()
$development = (git rev-parse origin/Development).Trim()
if ($head -ne $development) {
    throw "HEAD is not the pushed Development commit. Run .\deploy-dev.ps1 first."
}
& git merge-base --is-ancestor origin/master HEAD
if ($LASTEXITCODE -ne 0) {
    throw "origin/master is not an ancestor of Development. Production promotion is not a safe fast-forward."
}

Write-Host "Running repository checks before production promotion..." -ForegroundColor Cyan
& npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw "npm run check failed; production was not pushed or deployed." }

Run-Git push origin HEAD:master
Write-Host "Master pushed. Cloudflare will deploy production from Git automatically." -ForegroundColor Green

Write-Host "Deploying the same commit to Google Cloud Run production..." -ForegroundColor Cyan
& "$PSScriptRoot\scripts\deploy\deploy-cloud-run-production.ps1" -ProjectId $ProjectId -Region $Region -AllowAdvancedStatsCollectionDisabled
if ($LASTEXITCODE -ne 0) { throw "Cloud Run production deployment failed." }

# Keep the local master pointer useful without checking it out.
& git branch -f master HEAD 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Production succeeded, but the local master branch pointer could not be updated."
}

Write-Host "Production push + Google Cloud deploy completed." -ForegroundColor Green
Write-Host "Deployed commit: $head"
