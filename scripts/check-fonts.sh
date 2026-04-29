#!/usr/bin/env bash
# scripts/check-fonts.sh — Inter / JetBrains Mono loadout guard.
#
# CLAUDE.md mandates: every page loads Inter weights 400;500;600;700;800 and
# JetBrains Mono 400;500. Pages that reference 'JetBrains Mono' in CSS but
# don't load it via Google Fonts get a system-mono fallback (visible drift).
#
# Run from the repo root: bash scripts/check-fonts.sh
set -uo pipefail

CANON_INTER='family=Inter:wght@400;500;600;700;800'
CANON_JBM='family=JetBrains+Mono:wght@400;500'

ISSUES=0

for f in *.html; do
  # Skip the 404 dark-theme page — intentional palette variation per CLAUDE.md.
  [ "$f" = "404.html" ] && continue
  # Skip pure redirect stubs (dashboard.html etc.) — they don't render content.
  if grep -aq 'http-equiv="refresh"' "$f" 2>/dev/null; then continue; fi

  inter=$(grep -aoE 'family=Inter:wght@[0-9;]+' "$f" 2>/dev/null | head -1)
  jbm=$(grep -aoE 'family=JetBrains\+Mono:wght@[0-9;]+' "$f" 2>/dev/null | head -1)
  uses_jbm_in_css=$(grep -ac "JetBrains Mono" "$f" 2>/dev/null | head -1)
  uses_jbm_in_css=${uses_jbm_in_css:-0}

  problems=""
  if [ -z "$inter" ]; then
    problems+=$'\n  warn: no Inter <link>'
  elif [ "$inter" != "$CANON_INTER" ]; then
    problems+=$'\n  drift: Inter got '"$inter"' want '"$CANON_INTER"
  fi
  if [ "$uses_jbm_in_css" -gt 0 ]; then
    if [ -z "$jbm" ]; then
      problems+=$'\n  drift: references JetBrains Mono in CSS but does NOT load it'
    elif [ "$jbm" != "$CANON_JBM" ]; then
      problems+=$'\n  drift: JBM got '"$jbm"' want '"$CANON_JBM"
    fi
  fi
  if [ -n "$problems" ]; then
    echo "=== $f ==="
    echo "$problems"
    ISSUES=$((ISSUES + 1))
  fi
done

if [ "$ISSUES" -gt 0 ]; then
  echo ""
  echo "Font loadout drift on $ISSUES page(s). Canonical:"
  echo "<link href=\"https://fonts.googleapis.com/css2?$CANON_INTER&$CANON_JBM&display=swap\" rel=\"stylesheet\">"
fi

exit 0
