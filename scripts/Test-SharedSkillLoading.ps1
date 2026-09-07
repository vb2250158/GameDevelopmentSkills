#requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$ProjectPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectPath).Path
$config = Get-Content -LiteralPath (Join-Path $project '.agents/shared-skills.json') -Raw | ConvertFrom-Json
if ($config.schemaVersion -ne 1) { throw 'Unsupported project configuration schema.' }
$repository = if ($env:GAME_DEVELOPMENT_SKILLS_ROOT) {
    if (-not [IO.Path]::IsPathFullyQualified($env:GAME_DEVELOPMENT_SKILLS_ROOT)) { throw 'GAME_DEVELOPMENT_SKILLS_ROOT must be absolute.' }
    [IO.Path]::GetFullPath($env:GAME_DEVELOPMENT_SKILLS_ROOT)
} else {
    [IO.Path]::GetFullPath([string]$config.repositoryPath, $project)
}
$manifest = Get-Content -LiteralPath (Join-Path $repository 'team-skills.json') -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1) { throw 'Unsupported shared skill manifest schema.' }
$names = @($manifest.core) + @($manifest.optional)
if (($names | Select-Object -Unique).Count -ne $names.Count) { throw 'Duplicate skill names.' }
foreach ($name in $names) {
    if ($name -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { throw "Invalid skill name: $name" }
    $entry = Join-Path $repository "$name/SKILL.md"
    if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw "Missing skill: $entry" }
}
foreach ($dependency in $manifest.dependencies.PSObject.Properties) {
    foreach ($name in @($dependency.Name) + @($dependency.Value)) {
        if ($name -notin $names) { throw "Unregistered dependency: $name" }
    }
}
foreach ($relative in @('AGENTS.md', '.github/copilot-instructions.md', '.agents/skills/shared-game-development/SKILL.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $project $relative) -PathType Leaf)) { throw "Missing project entry: $relative" }
}
$bindingPath = Join-Path $repository 'current-language-style/references/runtime-settings.json'
# Read the actual binding rather than assuming a user-level style installation.
if (-not (Test-Path -LiteralPath $bindingPath)) { throw "Missing style binding: $bindingPath" }
$binding = Get-Content -LiteralPath $bindingPath -Raw | ConvertFrom-Json
$styleRoot = Join-Path $repository 'current-language-style'
foreach ($relative in @("$($binding.activeStyleSkillUrl)/SKILL.md", $binding.activeStyleData)) {
    $target = [IO.Path]::GetFullPath($relative, $styleRoot)
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing bound style file: $target" }
}
[pscustomobject]@{ Project = $project; Repository = $repository; Skills = $names.Count; Dependencies = 'Resolved'; Writes = 0 }
