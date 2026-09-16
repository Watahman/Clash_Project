param(
    [string]$ProjectId = "clashpanel",
    [string]$Region = "europe-west1",
    [string]$PreviewOrigin = "https://clashpanel-phase8-preview.emile-vandewaetere.workers.dev",
    [string]$CommitMessage = ""
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
    throw "Development deploy must be run from the Development branch. Current branch: $branch"
}

Run-Git fetch origin Development master --prune --quiet
& git merge-base --is-ancestor origin/Development HEAD
if ($LASTEXITCODE -ne 0) {
    throw "origin/Development is not an ancestor of HEAD. Pull/reconcile the remote branch before deploying."
}
$status = @(git status --porcelain)
if ($status.Count -gt 0) {
    Run-Git add -A
    & git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw "Staged changes failed git diff --check." }
}

Write-Host "Running repository checks before Development push..." -ForegroundColor Cyan
& npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw "npm run check failed; nothing was pushed or deployed." }

if ($status.Count -gt 0) {
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        $CommitMessage = "deploy: development " + (Get-Date -Format "yyyy-MM-dd HH:mm")
    }
    Run-Git commit -m $CommitMessage
}

if (@(git status --porcelain).Count -gt 0) {
    throw "Working tree is not clean after validation/commit. Deployment stopped."
}

Run-Git push origin HEAD:Development

Write-Host "Development pushed. Cloudflare will deploy from Git automatically." -ForegroundColor Green
Write-Host "Deploying the zero-traffic Cloud Run preview..." -ForegroundColor Cyan
& "$PSScriptRoot\scripts\deploy\deploy-cloud-run-preview.ps1" -ProjectId $ProjectId -Region $Region -PreviewOrigin $PreviewOrigin
if ($LASTEXITCODE -ne 0) { throw "Cloud Run preview deployment failed." }

Write-Host "Development push + Google Cloud preview deploy completed." -ForegroundColor Green
