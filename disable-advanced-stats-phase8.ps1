param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$SchedulerJobName = "clashpanel-advanced-stats-poll"
)

$ErrorActionPreference = "Stop"

Write-Host "Applying Advanced Stats Phase 8 kill switch..." -ForegroundColor Yellow

& gcloud scheduler jobs pause $SchedulerJobName --project $ProjectId --location $Region
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Scheduler pause failed; continuing with Cloud Run collection disable."
}

& gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --update-env-vars="ADVANCED_STATS_COLLECTION_ENABLED=false,ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false"
if ($LASTEXITCODE -ne 0) {
    throw "Could not disable Advanced Stats collection on Cloud Run."
}

Write-Host "Advanced Stats kill switch applied." -ForegroundColor Green
Write-Host "  Collection: OFF"
Write-Host "  Public enrollment: OFF"
Write-Host "  Scheduler: PAUSED (if the job exists and your account has permission)"
Write-Host "Existing tracked history is preserved; this does not delete user data."
