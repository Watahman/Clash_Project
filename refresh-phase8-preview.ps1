param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [Guid]$DeveloperUserId,

    [Parameter(Mandatory = $true)]
    [string]$PreviewOrigin,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$TagName = "phase8"
)

$ErrorActionPreference = "Stop"

function Invoke-Phase8Step {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "" 
    Write-Host "== $Label ==" -ForegroundColor Cyan
    & $Action
}

$requiredScripts = @(
    "./deploy-cloud-run-phase8.ps1",
    "./configure-advanced-stats-phase8.ps1",
    "./deploy-phase8-preview.ps1"
)
foreach ($script in $requiredScripts) {
    if (-not (Test-Path $script)) {
        throw "Required Phase 8 helper is missing: $script"
    }
}

Write-Host "Refreshing the isolated Phase 8 preview from the current checkout." -ForegroundColor Cyan
Write-Host "Safety policy for this refresh:" -ForegroundColor Yellow
Write-Host "  production traffic to candidate remains 0%"
Write-Host "  public Advanced Stats enrollment remains OFF"
Write-Host "  Advanced Stats collection remains OFF"
Write-Host "  Scheduler ends PAUSED"
Write-Host "  developer rollout allowlist is restored after backend deployment"
Write-Host "  production clashpanel.com is not redeployed"

Invoke-Phase8Step -Label "1/3 Deploy zero-traffic backend candidate" -Action {
    & ./deploy-cloud-run-phase8.ps1 `
        -ProjectId $ProjectId `
        -Region $Region `
        -ServiceName $ServiceName `
        -TagName $TagName
}

Invoke-Phase8Step -Label "2/3 Restore developer-only Phase 8 configuration" -Action {
    & ./configure-advanced-stats-phase8.ps1 `
        -ProjectId $ProjectId `
        -DeveloperUserId $DeveloperUserId `
        -Region $Region `
        -ServiceName $ServiceName `
        -TagName $TagName
}

Invoke-Phase8Step -Label "3/3 Deploy isolated Cloudflare preview" -Action {
    & ./deploy-phase8-preview.ps1 `
        -ProjectId $ProjectId `
        -Region $Region `
        -ServiceName $ServiceName `
        -TagName $TagName `
        -PreviewOrigin $PreviewOrigin
}

Write-Host "" 
Write-Host "Phase 8 preview refresh completed." -ForegroundColor Green
Write-Host "  Candidate normal production traffic: 0%"
Write-Host "  Public enrollment: OFF"
Write-Host "  Collection: OFF"
Write-Host "  Scheduler: PAUSED"
Write-Host "  Preview origin: $PreviewOrigin"
Write-Host ""
Write-Host "Open $PreviewOrigin/app/achievements for the achievement changes."
Write-Host "Do not enable collection or resume the Scheduler until the runtime gate is intentionally continued."
