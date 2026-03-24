#!/bin/bash
#
# Verify the production build doesn't bundle vue-component-meta/TypeScript
# and the component-index is correctly generated for both SSR and SSG.
#
# Usage: ./test/verify-production-bundle.sh
#
set -e

cd "$(dirname "$0")/.."
OUTPUT=playground/.output
ERRORS=0

check_index() {
  local INDEX=$1
  if [ -f "$INDEX" ] && grep -q '"components"' "$INDEX"; then
    echo "PASS: component-index.json generated"
  else
    echo "FAIL: component-index.json not found or invalid"; ERRORS=$((ERRORS+1))
  fi
}

# --- SSR Build ---
echo "=== SSR Build (nuxt build) ==="
rm -rf $OUTPUT
NUXT_APP_CDN_URL=http://localhost:3000 npx nuxi build playground --quiet 2>&1 | tail -3

check_index $OUTPUT/public/nuxt-component-preview/component-index.json

SIZE=$(du -sb $OUTPUT/server/ | cut -f1)
echo "Server bundle: $((SIZE / 1024))KB"
if [ "$SIZE" -gt 3145728 ]; then
  echo "FAIL: server bundle > 3MB — heavy deps likely bundled"
  ERRORS=$((ERRORS+1))
else
  echo "PASS: server bundle under 3MB"
fi

# --- SSG Build ---
echo ""
echo "=== SSG Build (nuxt generate) ==="
rm -rf $OUTPUT
NUXT_APP_CDN_URL=http://localhost:3000 npx nuxi generate playground --quiet 2>&1 | tail -3

check_index $OUTPUT/public/nuxt-component-preview/component-index.json

echo ""
echo "=== Results ==="
[ $ERRORS -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "$ERRORS CHECK(S) FAILED"; exit 1; }
