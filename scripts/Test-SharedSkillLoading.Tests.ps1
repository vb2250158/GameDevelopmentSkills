#requires -Version 7.0
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot 'Test-SharedSkillLoading.ps1'
$source = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('shared-skills-' + [Guid]::NewGuid().ToString('N'))
$project = Join-Path $fixture 'Art Project'
$shared = Join-Path $fixture 'GameDevelopmentSkills'
$savedOverride = $env:GAME_DEVELOPMENT_SKILLS_ROOT
$passed = 0
function Check([bool]$Condition, [string]$Label) {
    if (-not $Condition) { throw "FAILED: $Label" }
    $script:passed++
}
function Expect-Failure([scriptblock]$Action, [string]$Label) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Check $failed $Label
}
try {
    $env:GAME_DEVELOPMENT_SKILLS_ROOT = $null
    $null = New-Item -ItemType Directory -Path "$project/.agents/skills/shared-game-development", "$project/.github", $shared -Force
    Copy-Item -LiteralPath "$source/templates/shared-skills.json" -Destination "$project/.agents/shared-skills.json"
    foreach ($entry in @('AGENTS.md', '.github/copilot-instructions.md', '.agents/skills/shared-game-development/SKILL.md')) {
        Set-Content -LiteralPath (Join-Path $project $entry) -Value '# Synthetic project entry' -Encoding utf8
    }
    Copy-Item -LiteralPath "$source/team-skills.json" -Destination "$shared/team-skills.json"
    $manifest = Get-Content -LiteralPath "$shared/team-skills.json" -Raw | ConvertFrom-Json
    foreach ($name in @($manifest.core) + @($manifest.optional)) {
        $null = New-Item -ItemType Directory -Path "$shared/$name" -Force
        Set-Content -LiteralPath "$shared/$name/SKILL.md" -Value '# Synthetic skill' -Encoding utf8
    }
    $null = New-Item -ItemType Directory -Path "$shared/current-language-style/references", "$shared/direct-evidence-language-style/references" -Force
    Copy-Item -LiteralPath "$source/current-language-style/references/runtime-settings.json" -Destination "$shared/current-language-style/references/runtime-settings.json"
    Set-Content -LiteralPath "$shared/direct-evidence-language-style/references/style-data.json" -Value '{}' -Encoding utf8
    $first = & $validator -ProjectPath $project
    Check ($first.Repository -eq $shared -and $first.Skills -eq (@($manifest.core) + @($manifest.optional)).Count -and $first.Writes -eq 0) 'Relocated sibling checkout with spaces'
    Check (-not (Test-Path -LiteralPath "$project/.agents/skills/current-language-style")) 'No copied skill installation'
    Push-Location ([IO.Path]::GetTempPath())
    try { $otherCwd = & $validator -ProjectPath $project } finally { Pop-Location }
    Check ($otherCwd.Repository -eq $shared) 'Resolution independent of shell working directory'
    $env:GAME_DEVELOPMENT_SKILLS_ROOT = $shared
    Check ((& $validator -ProjectPath $project).Repository -eq $shared) 'Explicit repository override'
    $env:GAME_DEVELOPMENT_SKILLS_ROOT = 'relative-path'
    Expect-Failure { & $validator -ProjectPath $project } 'Reject relative environment override'
    $env:GAME_DEVELOPMENT_SKILLS_ROOT = $null
    $manifest.optional += 'new-shared-skill'
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$shared/team-skills.json" -Encoding utf8
    Expect-Failure { & $validator -ProjectPath $project } 'Reject missing skill after incomplete update'
    $null = New-Item -ItemType Directory -Path "$shared/new-shared-skill"
    Set-Content -LiteralPath "$shared/new-shared-skill/SKILL.md" -Value '# Newly pulled skill' -Encoding utf8
    Check ((& $validator -ProjectPath $project).Skills -eq ($first.Skills + 1)) 'Updated shared source visible without reinstalling project'
    $manifest.dependencies.'current-language-style' = @('unregistered-style')
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$shared/team-skills.json" -Encoding utf8
    Expect-Failure { & $validator -ProjectPath $project } 'Reject unregistered dependency'
    [pscustomobject]@{ Passed = $passed; Failed = 0; Fixture = $fixture }
} finally {
    $env:GAME_DEVELOPMENT_SKILLS_ROOT = $savedOverride
}
