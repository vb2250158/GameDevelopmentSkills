[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryPath = if ($env:UNITY_YAML_PARSER_REPO) {
    $env:UNITY_YAML_PARSER_REPO
} else {
    Join-Path ([Environment]::GetFolderPath('UserProfile')) '.local/share/unity-yaml-parser'
}

$python = Join-Path $repositoryPath '.venv\Scripts\python.exe'
$cli = Join-Path $PSScriptRoot 'unity_prefab_yaml.py'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw "unity-yaml-parser Python environment not found: $python. Run install-unity-yaml-parser.ps1 first."
}
if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) {
    throw "Prefab YAML CLI not found: $cli"
}

& $python $cli @CliArgs
exit $LASTEXITCODE
