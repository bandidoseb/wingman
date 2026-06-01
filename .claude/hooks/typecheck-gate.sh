#!/usr/bin/env bash
#
# Wingman typecheck gate (Stop hook).
# DETERMINISTIC safety net: Claude can never end a coding turn while TypeScript is broken.
# CLAUDE.md is advisory; this hook is enforced.
#
# Behavior:
#   - Runs ONLY when .ts/.tsx files have changed (unstaged, staged, OR new/untracked),
#     so pure chat / strategy turns stay instant.
#   - Scope-aware: typechecks the web app (tsconfig.json) and/or the Electron app
#     (tsconfig.electron.json) depending on which side actually changed.
#   - On any type error: exits 2 -> feeds the errors back to Claude and blocks the
#     turn from ending until they're fixed.
#
# To disable temporarily: remove the "Stop" block from .claude/settings.json.

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Collect changed/added TS files: unstaged + staged + untracked (new files included).
changed=$( {
  git diff --name-only --diff-filter=ACMR
  git diff --cached --name-only --diff-filter=ACMR
  git ls-files --others --exclude-standard
} 2>/dev/null )

ts_files=$(echo "$changed" | grep -E '\.(ts|tsx)$')
[ -z "$ts_files" ] && exit 0

# Scope: electron/* -> electron tsconfig; everything else -> web tsconfig.
check_electron=0
check_web=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    electron/*) check_electron=1 ;;
    *)          check_web=1 ;;
  esac
done <<< "$ts_files"

errors=""
if [ "$check_web" -eq 1 ]; then
  out=$(npx tsc --noEmit -p tsconfig.json 2>&1) || errors="${errors}
--- WEB (tsconfig.json) ---
${out}"
fi
if [ "$check_electron" -eq 1 ]; then
  out=$(npx tsc --noEmit -p tsconfig.electron.json 2>&1) || errors="${errors}
--- ELECTRON (tsconfig.electron.json) ---
${out}"
fi

if [ -n "$errors" ]; then
  echo "TypeScript errors must be fixed before finishing this turn:${errors}" >&2
  exit 2
fi

# Types are clean — now run the unit tests (fast, pure logic). Block on failure.
test_out=$(npx vitest run 2>&1)
if [ $? -ne 0 ]; then
  echo "Unit tests failed — fix before finishing this turn:" >&2
  echo "$test_out" | tail -40 >&2
  exit 2
fi

exit 0
