#!/bin/sh
set -eu
SELF="$(cd "$(dirname "$0")" && pwd)"
SRC="$SELF/luch"
NODE=""
for CANDIDATE in "$HOME/.luch/node/v24.16.0/bin/node" /usr/local/bin/node /opt/homebrew/bin/node; do
 if [ -x "$CANDIDATE" ]; then NODE="$CANDIDATE";break;fi
done
if [ -z "$NODE" ]; then
 echo "LUCH_SETUP_ERROR=INSTALL_OFFICIAL_LUCH_COMPANION_FIRST" >&2
 exit 1
fi
if [ "$#" -ge 1 ] && [ "$1" = "--install" ]; then
 exec "$NODE" "$SRC/installer/activate.mjs" "$@"
else
 exec "$NODE" "$SRC/installer/desktop-setup.mjs" "$@"
fi
