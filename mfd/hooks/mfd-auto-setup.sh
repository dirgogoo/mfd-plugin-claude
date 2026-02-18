#!/usr/bin/env bash
# Hook: SessionStart — Auto-install MFD plugin dependencies on first use
# Runs silently; only outputs if something needs to happen.

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Install npm dependencies if missing or incomplete
# Check for critical dependency: SDK must have .js files (not just .d.ts/.js.map)
SDK_PKG="$PLUGIN_DIR/node_modules/@modelcontextprotocol/sdk/package.json"
SDK_SERVER_JS="$PLUGIN_DIR/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js"
NEEDS_INSTALL=false

if [ ! -d "$PLUGIN_DIR/node_modules" ]; then
  NEEDS_INSTALL=true
elif [ ! -f "$SDK_PKG" ] || [ ! -f "$SDK_SERVER_JS" ]; then
  # Corrupted install — nuke and reinstall
  rm -rf "$PLUGIN_DIR/node_modules" "$PLUGIN_DIR/package-lock.json"
  npm cache clean --force --silent 2>/dev/null
  NEEDS_INSTALL=true
fi

if [ "$NEEDS_INSTALL" = true ]; then
  (cd "$PLUGIN_DIR" && npm install --omit=dev --silent 2>/dev/null)
  if [ $? -eq 0 ] && [ -f "$SDK_SERVER_JS" ]; then
    echo "[MFD] Dependencies installed successfully."
  else
    echo "[MFD] Warning: Failed to install dependencies. MCP tools may not work."
    echo "[MFD] Run manually: cd $PLUGIN_DIR && rm -rf node_modules && npm install --omit=dev"
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
