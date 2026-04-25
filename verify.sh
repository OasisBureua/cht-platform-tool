#!/usr/bin/env bash
# verify.sh — run before pushing to a branch
#
# Runs frontend + backend typecheck, lint, and unit tests. Mirrors what
# `.github/workflows/pr-validation.yml` does on GitHub so you catch the
# failure locally in 60s instead of after a failed PR check.
#
# Usage:
#   ./verify.sh           # run everything
#   ./verify.sh frontend  # frontend only
#   ./verify.sh backend   # backend only
#
# Exit code 0 = pass, non-zero = fail.

set -e

TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
fail=0

run_step() {
  local label="$1"; shift
  echo "→ $label"
  if ! "$@"; then
    echo "✗ $label FAILED"
    fail=1
  fi
}

if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then
  if [ -d "$REPO_ROOT/frontend" ]; then
    cd "$REPO_ROOT/frontend"
    run_step "frontend: tsc --noEmit" npx --no-install tsc --noEmit
    run_step "frontend: eslint" npm run lint --silent
    run_step "frontend: vitest" npm test --silent
  fi
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
  if [ -d "$REPO_ROOT/backend" ]; then
    cd "$REPO_ROOT/backend"
    run_step "backend: nest build" npm run build --silent
    run_step "backend: eslint" npm run lint --silent
    run_step "backend: jest" npm test --silent -- --passWithNoTests
  fi
fi

# Reject .env commits
cd "$REPO_ROOT"
staged_envs=$(git diff --cached --name-only 2>/dev/null | grep -E '(^|/)\.env(\..*)?$' || true)
if [ -n "$staged_envs" ]; then
  echo "✗ Refusing to commit .env files:"
  echo "$staged_envs"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "✗ verify FAILED — fix the issues above before pushing."
  exit 1
fi

echo ""
echo "✓ verify passed."
