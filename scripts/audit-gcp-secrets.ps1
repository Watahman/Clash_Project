[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectId,

    [string]$Region = "europe-west1"
)

$ErrorActionPreference = "Stop"

function Invoke-GcloudJson {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $raw = & gcloud @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning ("Read-only gcloud query failed; skipped: gcloud " + ($Arguments -join " "))
        return $null
    }

    $text = ($raw | ForEach-Object { [string]$_ }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    try {
        return ConvertFrom-Json -InputObject $text
    } catch {
        Write-Warning "gcloud returned data that could not be parsed as JSON; skipped this query."
        return $null
    }
}

function Get-ShortResourceName {
    param([AllowEmptyString()][string]$Name)

    if ([string]::IsNullOrWhiteSpace($Name)) { return "" }
    $normalized = $Name.Trim().TrimEnd("/")
    if ($normalized -match "/(?:secrets|services|revisions)/([^/]+)$") {
        return $matches[1]
    }
    return ($normalized -split "/")[-1]
}

function Get-CloudRunRegion {
    param([object]$Service)

    $labels = $Service.metadata.labels
    foreach ($candidate in @(
            $Service.location,
            $Service.region,
            $labels.'cloud.googleapis.com/location',
            $labels.'cloud.google.com/location')) {
        if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            return ([string]$candidate).Trim()
        }
    }
    return ""
}

function Get-CloudRunSecretReference {
    param([object]$EnvironmentEntry)

    $holders = @(
        $EnvironmentEntry.valueSource.secretKeyRef,
        $EnvironmentEntry.valueFrom.secretKeyRef
    )
    foreach ($holder in $holders) {
        if ($holder -is [string] -and -not [string]::IsNullOrWhiteSpace($holder)) {
            return ([string]$holder).Trim()
        }
        foreach ($property in @("secret", "name")) {
            $candidate = [string]$holder.$property
            if (-not [string]::IsNullOrWhiteSpace($candidate)) {
                return $candidate.Trim()
            }
        }
    }
    return ""
}

function Get-TemplateSecretNames {
    param([object]$TemplateSpec)

    $names = New-Object System.Collections.Generic.List[string]
    foreach ($container in @($TemplateSpec.containers)) {
        foreach ($environmentEntry in @($container.env)) {
            $candidate = Get-CloudRunSecretReference $environmentEntry
            $candidate = Get-ShortResourceName $candidate
            if ($candidate) { $null = $names.Add($candidate) }
        }
    }
    foreach ($volume in @($TemplateSpec.volumes)) {
        $candidate = Get-ShortResourceName ([string]$volume.secret.secretName)
        if ($candidate) { $null = $names.Add($candidate) }
    }
    return @($names | Select-Object -Unique)
}

function Get-NumericVersion {
    param([object]$Version)

    $versionName = [string]$Version.name
    if ($versionName -match "(?:/versions/)?([0-9]+)$") {
        return [long]$matches[1]
    }
    return $null
}

function Get-VersionSummary {
    param(
        [Parameter(Mandatory = $true)][string]$SecretName,
        [Parameter(Mandatory = $true)][string]$Project
    )

    $versionResult = Invoke-GcloudJson @(
        "secrets", "versions", "list", $SecretName,
        "--project", $Project, "--format=json")
    if ($null -eq $versionResult) {
        return [pscustomobject]@{
            EnabledVersions = "unknown"
            DisabledVersions = "unknown"
            DestroyedVersions = "unknown"
            NewestVersion = "unknown"
            NewestState = "unknown"
        }
    }
    $versions = @($versionResult)
    $counts = @{ ENABLED = 0; DISABLED = 0; DESTROYED = 0 }
    $newestNumber = $null
    $newestState = ""
    foreach ($version in $versions) {
        $state = ([string]$version.state).ToUpperInvariant()
        if ($counts.ContainsKey($state)) { $counts[$state]++ }
        $number = Get-NumericVersion $version
        if ($null -ne $number) {
            if ($null -eq $newestNumber -or $number -gt $newestNumber) {
                $newestNumber = $number
                $newestState = $state
            }
        }
    }
    if ($null -eq $newestNumber) { $newestNumber = "none"; $newestState = "none" }
    return [pscustomobject]@{
        EnabledVersions = $counts.ENABLED
        DisabledVersions = $counts.DISABLED
        DestroyedVersions = $counts.DESTROYED
        NewestVersion = $newestNumber
        NewestState = $newestState
    }
}

$secretEntries = @(Invoke-GcloudJson @(
        "secrets", "list", "--project", $ProjectId, "--format=json"))
if ($null -eq $secretEntries -or $secretEntries.Count -eq 0) {
    Write-Warning "No Secret Manager secrets were returned for project '$ProjectId'."
}

$referencesBySecret = @{}
foreach ($entry in $secretEntries) {
    $secretName = Get-ShortResourceName ([string]$entry.name)
    if ($secretName) { $referencesBySecret[$secretName] = @() }
}

$serviceEntries = @(Invoke-GcloudJson @(
        "run", "services", "list", "--project", $ProjectId,
        "--platform", "managed", "--format=json"))
if ($null -eq $serviceEntries -or $serviceEntries.Count -eq 0) {
    Write-Warning "Cloud Run service references could not be detected; no service rows were returned."
}

foreach ($entry in $serviceEntries) {
    $serviceName = Get-ShortResourceName ([string]$entry.metadata.name)
    if (-not $serviceName) { $serviceName = Get-ShortResourceName ([string]$entry.name) }
    $serviceRegion = Get-CloudRunRegion $entry
    if (-not $serviceRegion) {
        $serviceRegion = $Region
        Write-Warning "Cloud Run region for '$serviceName' was not present in the list response; using -Region '$Region'."
    }

    $detail = Invoke-GcloudJson @(
        "run", "services", "describe", $serviceName,
        "--project", $ProjectId, "--region", $serviceRegion, "--format=json")
    if ($null -eq $detail) {
        Write-Warning "Cloud Run references for '$serviceName' could not be inspected."
        continue
    }

    foreach ($referencedName in @(Get-TemplateSecretNames $detail.spec.template.spec)) {
        if ($referencesBySecret.ContainsKey($referencedName)) {
            $referencesBySecret[$referencedName] += "service/$serviceName [$serviceRegion]"
        }
    }

    $revisionEntries = @(Invoke-GcloudJson @(
            "run", "revisions", "list", "--service", $serviceName,
            "--project", $ProjectId, "--region", $serviceRegion, "--format=json"))
    if ($null -eq $revisionEntries) {
        Write-Warning "Cloud Run revision references for '$serviceName' could not be inspected."
        continue
    }
    foreach ($revision in $revisionEntries) {
        $revisionName = Get-ShortResourceName ([string]$revision.metadata.name)
        if (-not $revisionName) { $revisionName = Get-ShortResourceName ([string]$revision.name) }
        foreach ($referencedName in @(Get-TemplateSecretNames $revision.spec)) {
            if ($referencesBySecret.ContainsKey($referencedName)) {
                $referencesBySecret[$referencedName] += "revision/$revisionName [$serviceRegion]"
            }
        }
    }
}

$rows = foreach ($entry in $secretEntries) {
    $secretName = Get-ShortResourceName ([string]$entry.name)
    if (-not $secretName) { continue }
    $summary = Get-VersionSummary -SecretName $secretName -Project $ProjectId
    $references = @($referencesBySecret[$secretName] | Sort-Object -Unique)
    $cloudRunReferences = "none detected"
    if ($references.Count -gt 0) {
        $cloudRunReferences = $references -join "; "
    }

    [pscustomobject]@{
        Name = $secretName
        EnabledVersions = $summary.EnabledVersions
        DisabledVersions = $summary.DisabledVersions
        DestroyedVersions = $summary.DestroyedVersions
        NewestVersion = $summary.NewestVersion
        NewestState = $summary.NewestState
        CloudRunReferenced = ($references.Count -gt 0)
        CloudRunReferences = $cloudRunReferences
    }
}

if ($rows) {
    $rows | Format-List
}
