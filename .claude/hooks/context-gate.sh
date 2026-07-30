#!/usr/bin/env bash
#
# Wingman Stop hook — keeps the context system from drifting back.
#
# WHY THIS IS A SEPARATE HOOK, NOT PART OF typecheck-gate.sh:
# typecheck-gate.sh exits early when no .ts/.tsx file changed. A wrap turn edits
# only markdown, so anything bolted onto that script would never run on exactly
# the turn it is needed. Separate file, separate trigger.
#
# WHAT IT BLOCKS: structural drift only — a 6th heading in NOW.md, resolved rows
# left in Known Issues, hand-typed branch/PR status, generated files edited by hand.
# All are cheap to fix and each error message names the destination.
#
# WHAT IT ONLY WARNS ABOUT: file sizes. token-lint.mjs already recorded the lesson —
# a hard gate on pre-existing debt "would have been disabled within a week."
#
# To disable temporarily: remove this hook from .claude/settings.json.

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Only run when context files actually changed — never tax a pure code turn.
changed=$( {
  git diff --name-only --diff-filter=ACMR
  git diff --cached --name-only --diff-filter=ACMR
  git ls-files --others --exclude-standard
} 2>/dev/null )

echo "$changed" | grep -qE '(^CLAUDE\.md|^context/|^Wingman Brain/|^tasks/.*\.md|\.claude/)' || exit 0

command -v node >/dev/null 2>&1 || exit 0

fail=0
out=""

# 1. Generated files must match their generator.
if ! gen_out=$(node scripts/context-gen.mjs --check 2>&1); then
  out="${out}${gen_out}\n"
  fail=1
fi

# 2. Structural rules.
if ! lint_out=$(node scripts/context-lint.mjs 2>&1); then
  out="${out}${lint_out}\n"
  fail=1
else
  # Surface warnings without blocking.
  echo "$lint_out" | grep -q "⚠️" && echo "$lint_out" >&2
fi

if [ "$fail" -eq 1 ]; then
  printf "%b" "$out" >&2
  echo "" >&2
  echo "Fix the above before ending the turn. Quick reference:" >&2
  echo "  npm run context:gen          # regenerate STATE.md + Build Log.md" >&2
  echo "  npm run context:lint         # re-check" >&2
  echo "  npm run context:verify       # prove nothing was lost" >&2
  exit 2
fi

exit 0
