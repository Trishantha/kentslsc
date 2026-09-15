#!/usr/bin/env bash
# Register this codespace's app port (3000) with GitHub's port-forwarding
# service so the public https://<codespace>-3000.app.github.dev URL serves the
# app. Normally the VS Code Ports panel does this, but nothing else inside the
# codespace can. The registration survives this script exiting; re-run it after
# a codespace stop/start if the public URL 404s again.
set -euo pipefail

PORT="${1:-3000}"
CODESPACE="${CODESPACE_NAME:?CODESPACE_NAME is not set}"

# `ports forward` is the only gh subcommand that registers a tunnel port. The
# local side only needs a free port; pick an uncommon high one.
gh codespace ports forward "$PORT:43981" -c "$CODESPACE" &
FORWARD_PID=$!
trap 'kill "$FORWARD_PID" 2>/dev/null || true' EXIT

# Wait for the port to appear in the tunnel service, then make it public.
for _ in $(seq 1 12); do
  if gh codespace ports -c "$CODESPACE" 2>/dev/null | grep -qE "^[[:space:]]*$PORT[[:space:]]"; then
    gh codespace ports visibility "$PORT:public" -c "$CODESPACE"
    gh codespace ports -c "$CODESPACE"
    exit 0
  fi
  sleep 2
done

echo "Port $PORT did not register in time" >&2
exit 1
