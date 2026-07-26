# Blocks agents from reading files that commonly hold secrets/credentials,
# so they never enter a transcript or get echoed into a plan/review file.
# Invoked via settings.json exec form: powershell.exe -File block-secrets.ps1

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }

try {
    $data = $inputJson | ConvertFrom-Json
} catch {
    exit 0
}

$filePath = $data.tool_input.file_path
if ([string]::IsNullOrWhiteSpace($filePath)) { exit 0 }

$base = Split-Path -Path $filePath -Leaf
$blockedPattern = '^\.env(\..*)?$|\.pem$|\.key$|^id_rsa(\..*)?$|^credentials\.json$|^secrets\.json$|\.p12$|\.pfx$'

if ($base -match $blockedPattern) {
    $reason = "Reading $base is blocked by the factory secrets guard. If the agent genuinely needs a value from this file, paste just that value into the conversation yourself."
    $result = @{
        hookSpecificOutput = @{
            hookEventName = "PreToolUse"
            permissionDecision = "deny"
            permissionDecisionReason = $reason
        }
    }
    $result | ConvertTo-Json -Depth 5 -Compress
}

exit 0
