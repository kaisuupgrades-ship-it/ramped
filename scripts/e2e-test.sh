#!/usr/bin/env bash
# End-to-end smoke test for the Ramped AI booking + admin APIs.
#
# Usage:
#   ADMIN_TOKEN=xxxxx ./scripts/e2e-test.sh
#   ADMIN_TOKEN=xxxxx BASE=https://staging.example.com ./scripts/e2e-test.sh
#
# Creates a clearly-labeled test booking, attaches a questionnaire, verifies it
# appears in the admin view, flips its status to "completed", then deletes it.
# Requires: curl, jq.

set -euo pipefail

BASE="${BASE:-https://30dayramp.com}"
TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "ADMIN_TOKEN env var is required." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq / apt install jq)." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
EMAIL="e2e-${STAMP}@ramped-qa.invalid"
NAME="E2E Test ${STAMP}"
COMPANY="Ramped QA"
# Pick 2 Wednesdays from now at 10:00 AM Chicago time.
# Chicago is UTC-5 during CDT, UTC-6 during CST; 10:00 AM CT is always within
# the same UTC date, so a fixed 15:00:00Z works for CDT and 16:00:00Z for CST.
# To keep it simple, pick 2 weeks from today at 15:30 UTC (10:30 AM CDT /
# 9:30 AM CST) — always inside the slot grid.
DATETIME="$(date -u -d '+14 days' +%Y-%m-%dT15:30:00Z 2>/dev/null \
         || date -u -v+14d +%Y-%m-%dT15:30:00Z)"
DATE="${DATETIME%T*}"

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

echo "Base:     $BASE"
echo "Email:    $EMAIL"
echo "Datetime: $DATETIME"
echo

# ─────────────────────────────────────────────────────────────────────────────
echo "[1/6] GET /api/book?date=$DATE — list booked slots"
body="$(curl -fsS "$BASE/api/book?date=$DATE")" || fail "request failed"
echo "$body" | jq -e '.booked | type == "array"' >/dev/null || fail "response missing .booked array"
pass "booked slots returned ($(echo "$body" | jq '.booked | length') slots)"

# ─────────────────────────────────────────────────────────────────────────────
echo "[2/6] POST /api/book — create test booking"
body="$(curl -fsS -X POST "$BASE/api/book" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg dt "$DATETIME" --arg name "$NAME" --arg email "$EMAIL" \
    --arg company "$COMPANY" --arg notes "E2E test booking — safe to delete" \
    --arg tz "America/Chicago" --arg tier "growth" \
    '{datetime:$dt,name:$name,email:$email,company:$company,notes:$notes,timezone:$tz,tier:$tier}')")" \
  || fail "request failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "booking POST did not return success"
pass "booking created"

# ─────────────────────────────────────────────────────────────────────────────
echo "[3/6] POST /api/questionnaire — attach answers"
body="$(curl -fsS -X POST "$BASE/api/questionnaire" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg email "$EMAIL" --arg tier "growth" '{
    email:$email, tier:$tier,
    bottleneck:"E2E test — checking questionnaire write path",
    industry:"QA",
    team_size:"1–5",
    tools:["Slack","HubSpot","Notion"],
    customer_channel:"Email"
  }')")" \
  || fail "request failed"
echo "$body" | jq -e '.success == true and .updated == true' >/dev/null \
  || fail "questionnaire did not attach (got: $body)"
pass "questionnaire saved to booking"

# ─────────────────────────────────────────────────────────────────────────────
echo "[4/6] GET /api/admin — verify booking visible with questionnaire"
body="$(curl -fsS "$BASE/api/admin?token=$(printf %s "$TOKEN" | jq -sRr @uri)")" \
  || fail "admin GET failed (check ADMIN_TOKEN)"
ID="$(echo "$body" | jq -r --arg email "$EMAIL" \
  '.bookings[] | select(.email==$email) | .id' | head -n1)"
[ -n "$ID" ] && [ "$ID" != "null" ] || fail "booking not found in admin view"
has_q="$(echo "$body" | jq -r --arg id "$ID" \
  '.bookings[] | select(.id==$id) | (.questionnaire != null and (.questionnaire|type)=="object")')"
[ "$has_q" = "true" ] || fail "booking $ID found but questionnaire not attached"
pass "booking visible in admin (id=$ID) with questionnaire attached"

# ─────────────────────────────────────────────────────────────────────────────
echo "[5/6] POST /api/admin-update — flip status + append note"
body="$(curl -fsS -X POST "$BASE/api/admin-update?token=$(printf %s "$TOKEN" | jq -sRr @uri)" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg id "$ID" \
    '{id:$id, status:"completed", admin_notes:"E2E test — status flipped by script"}')")" \
  || fail "admin-update failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "admin-update did not return success"
pass "status + notes updated"

# ─────────────────────────────────────────────────────────────────────────────
echo "[6/6] DELETE /api/admin-delete — remove test booking"
body="$(curl -fsS -X POST "$BASE/api/admin-delete?token=$(printf %s "$TOKEN" | jq -sRr @uri)" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg id "$ID" '{id:$id}')")" \
  || fail "admin-delete failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "admin-delete did not return success"
pass "test booking deleted"

echo
echo "All steps passed."
