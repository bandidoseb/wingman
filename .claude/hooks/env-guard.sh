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
exit 0
