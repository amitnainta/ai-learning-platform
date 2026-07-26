# Runs after every Edit/Write. Keep it fast; it fires on every file change.
# Stack: Next.js (React/TypeScript) monolith, single project root.

try {
    npx eslint --fix . | Out-Null
} catch {
    Write-Warning "post-edit: eslint --fix failed: $_"
}

try {
    npx prettier --write . | Out-Null
} catch {
    Write-Warning "post-edit: prettier --write failed: $_"
}

exit 0
