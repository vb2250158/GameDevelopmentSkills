#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'Install-TeamSkills.ps1'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('game-skills-test-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory((Join-Path $fixture 'Assets'))
[void][IO.Directory]::CreateDirectory((Join-Path $fixture 'ProjectSettings'))
$checks = 0
function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:checks++
}
$preview = & $installer -ProjectPath $fixture | ConvertFrom-Json
Assert-True (-not $preview.Applied -and -not (Test-Path -LiteralPath (Join-Path $fixture '.agents'))) 'Preview wrote files.'
$first = & $installer -ProjectPath $fixture -Apply | ConvertFrom-Json
Assert-True ($first.Applied -and $first.AddedOrPlanned -gt 0 -and $first.Skills.Count -eq 5) 'Core installation failed.'
$again = & $installer -ProjectPath $fixture -Apply | ConvertFrom-Json
Assert-True ($again.AddedOrPlanned -eq 0 -and $again.Unchanged -eq $first.AddedOrPlanned) 'Repeated installation was not idempotent.'
$bindingRoot = Join-Path $fixture '.agents/skills/current-language-style'
$binding = Get-Content -LiteralPath (Join-Path $bindingRoot 'references/runtime-settings.json') -Raw | ConvertFrom-Json
Assert-True (Test-Path -LiteralPath (Join-Path $bindingRoot ($binding.activeStyleSkillUrl + '/SKILL.md'))) 'Style skill binding cannot resolve.'
Assert-True (Test-Path -LiteralPath (Join-Path $bindingRoot $binding.activeStyleData)) 'Style data binding cannot resolve.'
$optional = & $installer -ProjectPath $fixture -Include project-progress-pm -Apply | ConvertFrom-Json
Assert-True ('ai-automation-workflow' -in $optional.Skills -and 'read-tencent-docs-opendoc' -in $optional.Skills) 'Optional dependencies were omitted.'
$target = Join-Path $fixture '.agents/skills/continuous-task-execution/SKILL.md'
[IO.File]::AppendAllText($target, "`nLocal custom rule.`n")
$hash = (Get-FileHash -LiteralPath $target).Hash
$rejected = $false
try { & $installer -ProjectPath $fixture -Include unity-prefab-source-editing -Apply | Out-Null } catch { $rejected = $_.Exception.Message -match 'Existing files differ' }
Assert-True ($rejected -and (Get-FileHash -LiteralPath $target).Hash -eq $hash -and -not (Test-Path -LiteralPath (Join-Path $fixture '.agents/skills/unity-prefab-source-editing'))) 'Conflict did not reject the whole batch or changed local content.'
$rejected = $false
try { & $installer -ProjectPath $fixture -Include '../outside' -Apply | Out-Null } catch { $rejected = $_.Exception.Message -match 'Unknown skill' }
Assert-True $rejected 'Traversal in a skill name was accepted.'
$rejected = $false
try { & $installer -ProjectPath (Join-Path $fixture 'Assets') -Apply | Out-Null } catch { $rejected = $_.Exception.Message -match 'not a Unity project' }
Assert-True $rejected 'Non-project target was accepted.'
$obstruction = Join-Path $fixture 'obstruction'
[void][IO.Directory]::CreateDirectory((Join-Path $obstruction 'Assets'))
[void][IO.Directory]::CreateDirectory((Join-Path $obstruction 'ProjectSettings'))
[IO.File]::WriteAllText((Join-Path $obstruction '.agents'), 'keep')
$rejected = $false
try { & $installer -ProjectPath $obstruction -Apply | Out-Null } catch { $rejected = $_.Exception.Message -match 'obstructed' }
Assert-True ($rejected -and [IO.File]::ReadAllText((Join-Path $obstruction '.agents')) -eq 'keep') 'Obstruction was not preserved.'
[pscustomobject]@{Passed=$checks; Failed=0; Fixture=$fixture} | ConvertTo-Json
