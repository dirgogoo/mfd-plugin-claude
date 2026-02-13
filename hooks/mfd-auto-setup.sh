#!/usr/bin/env bash
# Hook: SessionStart — Auto-install MFD plugin dependencies on first use
# Runs silently; only outputs if something needs to happen.

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Install npm dependencies if missing
if [ ! -d "$PLUGIN_DIR/node_modules" ]; then
  npm install --production --prefix "$PLUGIN_DIR" --silent 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "[MFD] Dependencies installed successfully."
  else
    echo "[MFD] Warning: Failed to install dependencies. MCP tools may not work."
    echo "[MFD] Run manually: cd $PLUGIN_DIR && npm install --production"
  fi
fi

# 2. Create symlink in ~/.local/bin/ so `mfd` command is available everywhere
LOCAL_BIN="$HOME/.local/bin"
MFD_BIN="$PLUGIN_DIR/bin/mfd"

if [ -x "$MFD_BIN" ] && [ ! -f "$LOCAL_BIN/mfd" ]; then
  mkdir -p "$LOCAL_BIN"
  ln -sf "$MFD_BIN" "$LOCAL_BIN/mfd"
  # Check if ~/.local/bin is in PATH
  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$LOCAL_BIN"; then
    echo "[MFD] Note: ~/.local/bin is not in your PATH."
    echo "[MFD] Add to your shell profile: export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

exit 0
