[CmdletBinding()]
param(
    [ValidateSet("WorkingTree", "Staged")]
    [string]$Scope = "WorkingTree",

    [ValidateSet("Info", "Low", "Medium", "High", "Critical")]
    [string]$FailOn = "High",

    [switch]$Json,

    [switch]$NoFail
)

$ErrorActionPreference = "Stop"

function Invoke-GitText {
    param([string[]]$Arguments)

    $result = & git @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($result -join [Environment]::NewLine)"
    }
    return @($result | ForEach-Object { [string]$_ })
}

function Test-PlaceholderValue {
    param([string]$Text)
    return $Text -match '(?i)(example|placeholder|dummy|fake|test[-_ ]?only|replace[-_ ]?me|your[-_ ]|<[^>]+>|\$\{[^}]+\}|process\.env|os\.environ|env:)'
}

$severityRank = @{
    Info = 0
    Low = 1
    Medium = 2
    High = 3
    Critical = 4
}

$rules = @(
    @{
        Id = "secret-private-key"
        Severity = "Critical"
        Pattern = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
        Message = "Private key material appears in an added line."
    },
    @{
        Id = "secret-provider-token"
        Severity = "Critical"
        Pattern = '(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|(?<![A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,})'
        Message = "A high-confidence provider token pattern appears in an added line."
    },
    @{
        Id = "secret-literal-assignment"
        Severity = "High"
        Pattern = '(?i)\b(?:SESSDATA|bili_jct|api[_-]?key|client[_-]?secret|password|access[_-]?token|bearer[_-]?token)\b\s*[:=]\s*["''][^"'']{12,}["'']'
        Message = "A sensitive key appears to receive a literal value."
        IgnorePlaceholder = $true
    },
    @{
        Id = "command-shell-execution"
        Severity = "High"
        Pattern = '(?i)(?:\bshell\s*[:=]\s*true\b|subprocess\.[A-Za-z_]+\([^\r\n]*shell\s*=\s*True|os\.system\s*\(|child_process\.(?:exec|execSync)\s*\()'
        Message = "Shell-backed or string command execution requires boundary review."
    },
    @{
        Id = "tls-verification-disabled"
        Severity = "High"
        Pattern = '(?i)(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*["'']?0)'
        Message = "TLS certificate verification appears to be disabled."
    },
    @{
        Id = "dynamic-code-execution"
        Severity = "Medium"
        Pattern = '(?i)(?:\beval\s*\(|\bnew\s+Function\s*\(|yaml\.(?:load|unsafe_load)\s*\()'
        Message = "Dynamic execution or an unsafe loader requires untrusted-input analysis."
    },
    @{
        Id = "raw-html-sink"
        Severity = "Medium"
        Pattern = '(?i)(?:dangerouslySetInnerHTML|\.\s*innerHTML\s*=)'
        Message = "A raw HTML sink requires context-aware sanitization review."
    },
    @{
        Id = "permissive-cors"
        Severity = "Medium"
        Pattern = '(?i)(?:origin\s*:\s*["'']\*["'']|Access-Control-Allow-Origin[^\r\n]*\*)'
        Message = "Wildcard CORS requires an explicit public-endpoint justification."
    },
    @{
        Id = "remote-listener"
        Severity = "Medium"
        Pattern = '(?i)(?:\b0\.0\.0\.0\b|\ballowRemote\s*[:=]\s*true\b)'
        Message = "A remote listener or remote-access switch requires authentication and opt-in review."
    }
)

$findings = [System.Collections.Generic.List[object]]::new()
$riskSurfaces = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$changedFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

function Add-RiskSurface {
    param([string]$FilePath)

    if ($FilePath -match '(?i)(^|/)(?:\.github/workflows|Dockerfile|[^/]*(?:auth|permission|security|secret|token|credential|config|outbox|action.?gate|agent|mcp|webhook|upload|install|build|package|deploy|release|policy|route|delivery|relay|manager|runtime|adapter|ipc)[^/]*)') {
        [void]$riskSurfaces.Add($FilePath)
    }
}

function Test-IntentionalScannerText {
    param(
        [string]$FilePath,
        [string]$Text,
        [string]$RuleId
    )

    if ($FilePath -match '(?i)(^|/)ai-code-security-review/scripts/Invoke-AICodeSecurityReview\.ps1$' -and
        $Text -match '^\s*Pattern\s*=') {
        return $true
    }

    return $false
}

function Test-AddedLine {
    param(
        [string]$FilePath,
        [int]$LineNumber,
        [string]$Text
    )

    foreach ($rule in $rules) {
        if ($Text -notmatch $rule.Pattern) {
            continue
        }
        if ($rule.IgnorePlaceholder -and (Test-PlaceholderValue -Text $Text)) {
            continue
        }
        if (Test-IntentionalScannerText -FilePath $FilePath -Text $Text -RuleId $rule.Id) {
            continue
        }
        $findings.Add([pscustomobject]@{
            severity = $rule.Severity
            rule = $rule.Id
            file = $FilePath
            line = $LineNumber
            message = $rule.Message
        })
    }
}

function Read-Diff {
    param([string[]]$Arguments)

    $currentFile = ""
    $newLineNumber = 0
    $inHunk = $false

    foreach ($line in (Invoke-GitText -Arguments $Arguments)) {
        if ($line -match '^\+\+\+ b/(.+)$') {
            $currentFile = $Matches[1]
            [void]$changedFiles.Add($currentFile)
            Add-RiskSurface -FilePath $currentFile
            $inHunk = $false
            continue
        }
        if ($line -match '^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@') {
            $newLineNumber = [int]$Matches[1]
            $inHunk = $true
            continue
        }
        if (-not $inHunk -or -not $currentFile) {
            continue
        }
        if ($line.StartsWith("+") -and -not $line.StartsWith("+++")) {
            Test-AddedLine -FilePath $currentFile -LineNumber $newLineNumber -Text $line.Substring(1)
            $newLineNumber += 1
            continue
        }
        if (-not $line.StartsWith("-")) {
            $newLineNumber += 1
        }
    }
}

$repoRootLines = @(Invoke-GitText -Arguments @("rev-parse", "--show-toplevel"))
$repoRoot = $repoRootLines[0].Trim()
if (-not $repoRoot) {
    throw "No Git repository root was found."
}

if ($Scope -eq "WorkingTree") {
    Read-Diff -Arguments @("diff", "--no-ext-diff", "--unified=0")
    Read-Diff -Arguments @("diff", "--cached", "--no-ext-diff", "--unified=0")
    $untrackedFiles = Invoke-GitText -Arguments @("ls-files", "--others", "--exclude-standard")
    foreach ($relativePath in $untrackedFiles) {
        if (-not $relativePath) {
            continue
        }
        [void]$changedFiles.Add($relativePath)
        Add-RiskSurface -FilePath $relativePath
        $absolutePath = Join-Path $repoRoot $relativePath
        $item = Get-Item -LiteralPath $absolutePath -ErrorAction SilentlyContinue
        if (-not $item -or $item.PSIsContainer -or $item.Length -gt 1MB) {
            continue
        }
        try {
            $bytes = [System.IO.File]::ReadAllBytes($absolutePath)
            if ($bytes.Length -eq 0) {
                continue
            }
            if ($bytes[0..([Math]::Min($bytes.Length - 1, 8191))] -contains 0) {
                continue
            }
            $lineNumber = 0
            foreach ($textLine in [System.IO.File]::ReadAllLines($absolutePath)) {
                $lineNumber += 1
                Test-AddedLine -FilePath $relativePath -LineNumber $lineNumber -Text $textLine
            }
        } catch {
            continue
        }
    }
} else {
    Read-Diff -Arguments @("diff", "--cached", "--no-ext-diff", "--unified=0")
}

$orderedFindings = @($findings | Sort-Object @{ Expression = { -$severityRank[$_.severity] } }, file, line, rule)
$counts = [ordered]@{}
foreach ($severity in @("Critical", "High", "Medium", "Low", "Info")) {
    $counts[$severity] = @($orderedFindings | Where-Object severity -eq $severity).Count
}

$threshold = $severityRank[$FailOn]
$shouldFail = @($orderedFindings | Where-Object { $severityRank[$_.severity] -ge $threshold }).Count -gt 0

$report = [pscustomobject]@{
    repository = $repoRoot
    scope = $Scope
    failOn = $FailOn
    passed = -not $shouldFail
    changedFileCount = $changedFiles.Count
    riskSurfaces = @($riskSurfaces | Sort-Object)
    counts = $counts
    findings = $orderedFindings
    note = "Prefilter only. A clean result still requires semantic trust-boundary review."
}

if ($Json) {
    $report | ConvertTo-Json -Depth 6
} else {
    Write-Output "AI code security prefilter"
    Write-Output "Repository: $repoRoot"
    Write-Output "Scope: $Scope"
    Write-Output "Changed files: $($changedFiles.Count)"
    Write-Output "Risk surfaces: $($riskSurfaces.Count)"
    foreach ($surface in ($riskSurfaces | Sort-Object)) {
        Write-Output "  - $surface"
    }
    Write-Output "Findings: Critical=$($counts.Critical) High=$($counts.High) Medium=$($counts.Medium) Low=$($counts.Low) Info=$($counts.Info)"
    foreach ($finding in $orderedFindings) {
        Write-Output "[$($finding.severity)] $($finding.rule) $($finding.file):$($finding.line) - $($finding.message)"
    }
    Write-Output $report.note
}

if ($shouldFail -and -not $NoFail) {
    exit 2
}
