param(
  [string]$Destination = "src/assets",
  [string]$Version = "0.16.0"
)

$ErrorActionPreference = "Stop"

Write-Host "ClashPanel asset collector"
Write-Host "Destination: $Destination"
Write-Host "Source package: clash-of-clans-data@$Version"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found in PATH."
}

$NodeVersion = (& node --version).Trim()
$NpmVersion = (& npm --version).Trim()
Write-Host "Node: $NodeVersion"
Write-Host "npm:  $NpmVersion"
Write-Host ""

# The upstream package declares Node >=24 because its JS API targets Node 24.
# ClashPanel's collector does NOT execute that package API; it only reads the
# bundled JSON and image files. We therefore disable npm's engine-strict check
# for this temporary asset-only install.
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("clashpanel-assets-" + [guid]::NewGuid().ToString("N"))

try {
  New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

  Write-Host "Downloading asset package into temporary directory..."
  Write-Host ""

  & npm install `
    --prefix $TempRoot `
    --ignore-scripts `
    --no-audit `
    --no-fund `
    --engine-strict=false `
    "clash-of-clans-data@$Version"

  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE."
  }

  $PackageRoot = Join-Path $TempRoot "node_modules\clash-of-clans-data"
  if (-not (Test-Path $PackageRoot)) {
    throw "Package installed, but its directory was not found: $PackageRoot"
  }

  Write-Host ""
  Write-Host "Package downloaded. Collecting and normalizing assets..."
  Write-Host ""

  & node "$PSScriptRoot\collect-clash-assets.mjs" `
    --package-root $PackageRoot `
    --dest $Destination `
    --version $Version

  if ($LASTEXITCODE -ne 0) {
    throw "Asset normalization failed with exit code $LASTEXITCODE."
  }

  Write-Host ""
  Write-Host "Done. Review:"
  Write-Host "  $Destination\game\manifest.json"
  Write-Host "  $Destination\sources\COLLECTION_REPORT.md"
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Recurse -Force $TempRoot -ErrorAction SilentlyContinue
  }
}