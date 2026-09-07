#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ProjectPath,
    [string[]]$Include = @(),
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = (Resolve-Path -LiteralPath $ProjectPath).Path
foreach ($directory in @('Assets', 'ProjectSettings')) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $directory) -PathType Container)) {
        throw "Target is not a Unity project: missing $directory"
    }
}
$catalog = Get-Content -LiteralPath (Join-Path $sourceRoot 'team-skills.json') -Raw | ConvertFrom-Json
$names = [Collections.Generic.List[string]]::new()
$pending = [Collections.Generic.Queue[string]]::new()
foreach ($name in @($catalog.core) + $Include) { $pending.Enqueue($name) }
$allowed = @($catalog.core) + @($catalog.optional)
while ($pending.Count) {
    $name = $pending.Dequeue()
    if ($name -notin $allowed -or $name -notmatch '^[a-z0-9-]+$') { throw "Unknown skill: $name" }
    if ($names.Contains($name)) { continue }
    $names.Add($name)
    $dependency = $catalog.dependencies.PSObject.Properties[$name]
    if ($null -ne $dependency) {
        foreach ($required in $dependency.Value) { $pending.Enqueue($required) }
    }
}
$targetRoot = Join-Path $projectRoot '.agents/skills'
$actions = [Collections.Generic.List[object]]::new()
$conflicts = [Collections.Generic.List[string]]::new()

# Validate the whole selection before making any directory or file changes.
foreach ($name in $names) {
    if ($name -notin $allowed -or $name -notmatch '^[a-z0-9-]+$') {
        throw "Unknown skill: $name"
    }
    $source = Join-Path $sourceRoot $name
    $target = Join-Path $targetRoot $name
    if (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md') -PathType Leaf)) {
        throw "Source skill is missing: $name"
    }
    # Avoid following a project junction into a different installation.
    $ancestor = $target
    while ($ancestor -and $ancestor -ne (Split-Path -Parent $projectRoot)) {
        if (Test-Path -LiteralPath $ancestor) {
            $entry = Get-Item -LiteralPath $ancestor -Force
            if (-not $entry.PSIsContainer -or $entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Target contains an obstructed directory, symbolic link or junction: $ancestor"
            }
        }
        $ancestor = Split-Path -Parent $ancestor
    }
    foreach ($file in Get-ChildItem -LiteralPath $source -Recurse -File -Force) {
        $relative = [IO.Path]::GetRelativePath($source, $file.FullName)
        if ($relative -match '(^|[\\/])(__pycache__|\.git)([\\/]|$)' -or $file.Extension -eq '.pyc') { continue }
        $destination = Join-Path $target $relative
        $state = 'Add'
        if (Test-Path -LiteralPath $destination) {
            if (-not (Test-Path -LiteralPath $destination -PathType Leaf) -or
                (Get-Item -LiteralPath $destination -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                $conflicts.Add($destination)
                continue
            }
            if ((Get-FileHash -LiteralPath $file.FullName).Hash -eq (Get-FileHash -LiteralPath $destination).Hash) {
                $state = 'Unchanged'
            } else {
                $conflicts.Add($destination)
            }
        }
        # Reject linked or obstructed nested directories as well.
        $parent = Split-Path -Parent $destination
        while ($parent -ne $target -and $parent.Length -gt $target.Length) {
            if (Test-Path -LiteralPath $parent) {
                $item = Get-Item -LiteralPath $parent -Force
                if (-not $item.PSIsContainer -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                    $conflicts.Add($parent)
                }
            }
            $parent = Split-Path -Parent $parent
        }
        $actions.Add([pscustomobject]@{Source=$file.FullName; Destination=$destination; State=$state})
    }
}
if ($conflicts.Count) {
    $conflicts | Select-Object -Unique | ForEach-Object { Write-Host "Conflict: $_" }
    throw 'Existing files differ or a target is obstructed. Compare and merge them explicitly; no files were changed.'
}
foreach ($action in $actions) {
    if ($Apply -and $action.State -eq 'Add') {
        [void][IO.Directory]::CreateDirectory((Split-Path -Parent $action.Destination))
        [IO.File]::Copy($action.Source, $action.Destination, $false)
    }
}
[pscustomobject]@{
    Target = $targetRoot
    Applied = [bool]$Apply
    Skills = @($names)
    AddedOrPlanned = @($actions | Where-Object State -eq 'Add').Count
    Unchanged = @($actions | Where-Object State -eq 'Unchanged').Count
} | ConvertTo-Json -Depth 4
