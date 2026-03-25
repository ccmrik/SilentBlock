<#
.SYNOPSIS
  Bumps the version in manifest.json, commits, and tags.

.PARAMETER Part
  Which part to bump: major, minor, or patch (default: patch)

.EXAMPLE
  .\version-bump.ps1
  .\version-bump.ps1 -Part minor
  .\version-bump.ps1 -Part major
#>
param(
  [ValidateSet('major', 'minor', 'patch')]
  [string]$Part = 'patch'
)

$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot 'manifest.json'

# Read and parse
$json = Get-Content $manifestPath -Raw | ConvertFrom-Json
$oldVersion = $json.version
$parts = $oldVersion -split '\.'

if ($parts.Count -ne 3) {
  Write-Error "Unexpected version format: $oldVersion (expected X.Y.Z)"
  exit 1
}

$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

switch ($Part) {
  'major' { $major++; $minor = 0; $patch = 0 }
  'minor' { $minor++; $patch = 0 }
  'patch' { $patch++ }
}

$newVersion = "$major.$minor.$patch"

# Update manifest.json (preserve formatting by doing a string replace)
$raw = Get-Content $manifestPath -Raw
$raw = $raw -replace """version"":\s*""$([regex]::Escape($oldVersion))""", """version"": ""$newVersion"""
Set-Content $manifestPath -Value $raw -NoNewline

Write-Host "Version bumped: $oldVersion -> $newVersion" -ForegroundColor Green

# Git operations
git add manifest.json
git commit -m "Bump version to $newVersion"
git tag "v$newVersion"

Write-Host "Committed and tagged v$newVersion" -ForegroundColor Cyan
Write-Host "Run 'git push && git push --tags' to deploy." -ForegroundColor Yellow
