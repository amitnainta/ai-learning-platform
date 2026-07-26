# Blocks direct commit/push to main or master. Forces the factory pipeline
# through a feature branch, so /factory-ship is the only path to the base branch.
# Invoked via settings.json exec form: powershell.exe -File guard-git.ps1

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }

try {
    $data = $inputJson | ConvertFrom-Json
} catch {
    exit 0
}

$command = $data.tool_input.command
if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

$projectDir = $env:CLAUDE_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($projectDir)) { $projectDir = (Get-Location).Path }

$branch = ""
try {
    $branch = (git -C $projectDir branch --show-current 2>$null)
    if ($branch) { $branch = $branch.Trim() }
} catch {
    $branch = ""
}

function Deny([string]$reason) {
    $result = @{
        hookSpecificOutput = @{
            hookEventName = "PreToolUse"
            permissionDecision = "deny"
            permissionDecisionReason = $reason
        }
    }
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

$isPush = $command -match '^\s*git\s+push\b'
$isCommit = $command -match '^\s*git\s+commit\b'
$targetsMainMaster = $command -match '(^|\s)(main|master)(\s|$)'
$onProtectedBranch = ($branch -eq "main") -or ($branch -eq "master")

if ($isPush -and $targetsMainMaster) {
    Deny "Direct push to main/master is blocked. Work on a feature branch and merge via /factory-ship."
}
if ($isPush -and $onProtectedBranch) {
    Deny "You are on main/master. Create a feature branch before pushing."
}
if ($isCommit -and $onProtectedBranch) {
    Deny "You are on main/master. Create a feature branch (factory/<slug>) before committing."
}

exit 0
