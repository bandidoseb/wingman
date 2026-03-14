#!/bin/bash
# Wingman Knowledge Base — launchd startup wrapper
# Sources nvm if present (launchd doesn't load shell profiles)

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Common node install paths as fallback
for p in \
  "$NVM_DIR/versions/node/$(ls "$NVM_DIR/versions/node" 2>/dev/null | tail -1)/bin/node" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "/usr/bin/node"; do
  [ -x "$p" ] && { NODE="$p"; break; }
done

if [ -z "$NODE" ]; then
  echo "[start.sh] ERROR: node not found" >&2
  exit 1
fi

DIR="/Users/sebastianperez/Desktop/Wingman CC/knowledge-base"
cd "$DIR" || exit 1

echo "[start.sh] Starting with node: $NODE"
exec "$NODE" server.js
