#!/usr/bin/env bash
#
# Wingman PreToolUse guard.
# Deterministically BLOCKS any Edit/Write to an env/secrets file (CLAUDE.md hard rule #1:
# "Never touch .env.local. Ever. For any reason."). Hooks are enforced; CLAUDE.md is advisory.
#
# Reads the PreToolUse JSON on stdin, extracts the target file path, and exits 2 (deny)
# if it's a .env* file. Exit 2 blocks the tool call and tells Claude why.

input=$(cat)
file=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const ti=j.tool_input||{};process.stdout.write(ti.file_path||ti.path||"")}catch(e){process.stdout.write("")}})')

base=$(basename "$file" 2>/dev/null)
case "$base" in
  .env|.env.*)
    echo "BLOCKED: '$base' is a secrets/env file. CLAUDE.md hard rule #1 — never edit .env files. If a key must change, Sebastian does it manually in the file or in Railway." >&2
    exit 2
    ;;
esac

# --- Bash surface -----------------------------------------------------------
# This hook was wired only to Edit|Write|MultiEdit, so `echo KEY=x >> .env.local`
# walked straight past a guard whose entire purpose is "never touch .env.local."
# Only WRITE-shaped commands are blocked — reading, grepping, and listing stay
# allowed, because debugging "is the key set?" is legitimate and common.
cmd=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input||{}).command||"")}catch(e){process.stdout.write("")}})')

if [ -n "$cmd" ]; then
  # Normalise so quoting tricks don't slip through.
  norm=$(printf '%s' "$cmd" | tr -d "'\"")
  if printf '%s' "$norm" | grep -qE '(>>?[[:space:]]*[^[:space:]]*\.env([.[:alnum:]_-]*)?([[:space:]]|$)|tee[[:space:]]+(-a[[:space:]]+)?[^[:space:]]*\.env|sed[[:space:]]+-i[^|]*\.env|(^|[[:space:];&|])(rm|mv|cp|truncate|chmod)[[:space:]]+[^|]*\.env([.[:alnum:]_-]*)?([[:space:]]|$))'; then
    echo "BLOCKED: that command writes to (or removes) a .env file. CLAUDE.md hard rule #1 — never touch .env files, from any tool. Reading them is fine; changing them is Sebastian's job, in the file or in Railway." >&2
    exit 2
  fi
fi

exit 0
