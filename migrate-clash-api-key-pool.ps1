param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "europe-west1",
    [string]$ServiceName = "clashpanel-api",
    [string]$PoolSecretName = "clashpanel-coc-api-key-pool"
)

$ErrorActionPreference = "Stop"
$legacySecretNames = @("_API_KEY_ALL", "_API_KEY_ALL2", "_API_KEY_ALL3")

function Invoke-GcloudQuiet {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $null = & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Google Cloud-opdracht mislukt zonder dat geheime waarden zijn getoond."
    }
}

function Read-LegacyKeys {
    param([string[]]$SecretNames)

    $unique = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )
    $keys = [System.Collections.Generic.List[string]]::new()
    foreach ($secretName in $SecretNames) {
        $value = @(& gcloud secrets versions access latest `
            --secret $secretName `
            --project $ProjectId 2>$null) -join ""
        $value = $value.Trim()
        if ($LASTEXITCODE -ne 0 -or -not $value) {
            throw "Bestaande Clash API-secret '$secretName' kon niet veilig worden gelezen."
        }
        if ($value.StartsWith("Bearer ", [System.StringComparison]::OrdinalIgnoreCase)) {
            $value = $value.Substring(7).Trim()
        }
        if (-not $value -or $value -match '\s') {
            throw "Bestaande Clash API-secret '$secretName' bevat geen bruikbare sleutel."
        }
        if ($unique.Add($value)) {
            $keys.Add($value)
        }
    }
    return $keys
}

Invoke-GcloudQuiet config set project $ProjectId
Invoke-GcloudQuiet services enable secretmanager.googleapis.com run.googleapis.com

$keys = @(Read-LegacyKeys -SecretNames $legacySecretNames)
if ($keys.Count -lt 1 -or $keys.Count -gt 10) {
    throw "De samengestelde Clash API-keypool moet 1 tot 10 unieke sleutels bevatten."
}

$existing = @(& gcloud secrets describe $PoolSecretName `
    --project $ProjectId `
    --format="value(name)" 2>$null) -join ""
$existing = $existing.Trim()
if (-not $existing) {
    Invoke-GcloudQuiet secrets create $PoolSecretName `
        --project $ProjectId `
        --replication-policy automatic
}

$serialized = ConvertTo-Json -InputObject ([string[]]$keys) -Compress
$keyCount = $keys.Count
$serialized | & gcloud secrets versions add $PoolSecretName `
    --project $ProjectId `
    --data-file=- `
    --quiet | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "De nieuwe keypoolversie kon niet veilig worden opgeslagen."
}

$serviceAccount = @(& gcloud run services describe $ServiceName `
    --project $ProjectId `
    --region $Region `
    --format="value(spec.template.spec.serviceAccountName)") -join ""
$serviceAccount = $serviceAccount.Trim()
if ($LASTEXITCODE -ne 0 -or -not $serviceAccount) {
    throw "Het Cloud Run-serviceaccount kon niet worden bepaald."
}

Invoke-GcloudQuiet secrets add-iam-policy-binding $PoolSecretName `
    --project $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/secretmanager.secretAccessor" `
    --quiet

$serialized = $null
$keys = @()
Write-Host "Een gedeelde Clash API-keypool is veilig voorbereid in Secret Manager." -ForegroundColor Green
Write-Host "Secret: $PoolSecretName"
Write-Host "Unieke sleutels: $keyCount"
Write-Host "Er zijn geen sleutelwaarden weergegeven of in repositorybestanden geschreven."
