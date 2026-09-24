#!/bin/sh
set -eu

: "${GCS_KEY_JSON:?GCS_KEY_JSON is required}"
: "${GCS_KEY_FILE:?GCS_KEY_FILE is required}"

umask 077
mkdir -p "$(dirname "$GCS_KEY_FILE")"
printf '%s' "$GCS_KEY_JSON" > "$GCS_KEY_FILE"

exec node server/app.mjs
