[CmdletBinding()]
param(
    [string]$RepositoryUrl = 'https://github.com/vb2250158/unity-yaml-parser.git',
    [string]$UpstreamUrl = 'https://github.com/socialpoint-labs/unity-yaml-parser.git',
    [string]$TargetPath = $(if ($env:UNITY_YAML_PARSER_REPO) { $env:UNITY_YAML_PARSER_REPO } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.local/share/unity-yaml-parser' }),
    [ValidatePattern('^\d+\.\d+$')]
    [string]$PythonVersion = '3.11'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)
if (Test-Path -LiteralPath $resolvedTarget) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedTarget '.git') -PathType Container)) {
        throw "Target exists but is not a Git repository: $resolvedTarget"
    }
} else {
    $parent = Split-Path -Parent $resolvedTarget
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    git clone $RepositoryUrl $resolvedTarget
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
}

Push-Location $resolvedTarget
try {
    $origin = (git remote get-url origin 2>$null).Trim()
    if (-not $origin) { throw 'The repository has no origin remote.' }

    $upstream = (git remote get-url upstream 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
        git remote add upstream $UpstreamUrl
        if ($LASTEXITCODE -ne 0) { throw 'Failed to add upstream remote.' }
    }

    $python = Join-Path $resolvedTarget '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
        py "-$PythonVersion" -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw "Failed to create Python $PythonVersion virtual environment." }
    }

    & $python -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw 'Failed to update pip.' }
    & $python -m pip install -e . pytest
    if ($LASTEXITCODE -ne 0) { throw 'Failed to install unityparser and pytest.' }
    & $python -m pytest -q
    if ($LASTEXITCODE -ne 0) { throw 'unity-yaml-parser tests failed.' }

    [pscustomobject]@{
        RepositoryPath = $resolvedTarget
        Origin = $origin
        Upstream = (git remote get-url upstream).Trim()
        Python = $python
        UnityParserVersion = (& $python -c 'import unityparser; print(unityparser.__version__)').Trim()
    } | ConvertTo-Json -Compress
} finally {
    Pop-Location
}
