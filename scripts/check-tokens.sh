#!/usr/bin/env bash
# scripts/check-tokens.sh — design-token drift guard for protected pages.
#
# CLAUDE.md declares a canonical palette. Each protected page (admin, portal)
# ships its own inline :root block since they don't load /styles.css.
# This script compares each page's tokens against the canonical set and prints
# any drift. Exits 0 (warn-only) by default; flip the final line to exit on
# drift once the team's caught up.
#
# Run from the repo root: bash scripts/check-tokens.sh
set -uo pipefail

# Canonical palette per CLAUDE.md plus admin-only semantic extensions
# (--danger, --warn-bg, --warn-border) for destructive/warning surfaces.
declare -A CANON=(
  ['--ink']='#0B1220'
  ['--paper']='#FAFAF7'
  ['--line']='#E6E4DC'
  ['--muted']='#5B6272'
  ['--accent']='#1F4FFF'
  ['--accent-2']='#0B2A8C'
  ['--good']='#0F7A4B'
  ['--warn']='#B45309'
  ['--surface']='#F5F5F3'
  ['--ink-2']='#1A2233'
  ['--danger']='#c0392b'
  ['--warn-bg']='#FFFBEA'
  ['--warn-border']='#F5C842'
)

PAGES=(admin.html portal.html)

for f in "${PAGES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "skip: $f (not found)"
    continue
  fi
  echo "=== $f ==="
  awk '/:root\s*\{/,/\}/' "$f" \
    | grep -aoE '\-\-[a-z0-9-]+\s*:\s*[^;]+;' \
    | while IFS= read -r line; do
        key=$(echo "$line" | grep -aoE '\-\-[a-z0-9-]+' | head -1)
        val=$(echo "$line" | grep -aoE ':\s*[^;]+;' | sed -E 's/^:\s*//; s/;\s*$//' | tr -d ' ')
        canon=${CANON[$key]:-}
        if [ -z "$canon" ]; then
          echo "  warn: unknown token $key = $val"
        elif [ "${val,,}" != "${canon,,}" ]; then
          echo "  drift: $key = $val (canonical: $canon)"
        fi
      done
done

exit 0
