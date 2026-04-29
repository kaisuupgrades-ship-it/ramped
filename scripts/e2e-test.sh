#!/usr/bin/env bash
# End-to-end smoke test for the Ramped AI booking + admin APIs.
#
# Usage:
#   ADMIN_TOKEN=xxxxx ./scripts/e2e-test.sh
#   ADMIN_TOKEN=xxxxx BASE=https://staging.example.com ./scripts/e2e-test.sh
#
# Creates a clearly-labeled test booking, attaches a questionnaire, verifies it
# appears in the admin view, flips its status to "post_won", then deletes it.
# Requires: curl, jq.
#
# Audit V2 (2026-04-29): switched admin requests from `?token=` (removed in
# Phase 1 H2-5) to `Authorization: Bearer` headers; aligned status to the
# enum in api/admin-update.js (VALID_STATUSES).

set -euo pipefail

BASE="${BASE:-https://www.30dayramp.com}"
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
DATETIME="$(date -u -d '+14 days' +%Y-%m-%dT15:30:00Z 2>/dev/null \
         || date -u -v+14d +%Y-%m-%dT15:30:00Z)"
DATE="${DATETIME%T*}"

pass() { echo "  ok: $1"; }
fail() { echo "  fail: $1" >&2; exit 1; }

echo "Base:     $BASE"
echo "Email:    $EMAIL"
echo "Datetime: $DATETIME"
echo

# ─────────────────────────────────────────────────────────────────────────────
echo "[1/7] GET /api/book?date=$DATE — list booked slots"
body="$(curl -fsS "$BASE/api/book?date=$DATE")" || fail "request failed"
echo "$body" | jq -e '.booked | type == "array"' >/dev/null || fail "response missing .booked array"
pass "booked slots returned ($(echo "$body" | jq '.booked | length') slots)"

# ─────────────────────────────────────────────────────────────────────────────
echo "[2/7] POST /api/book — create test booking"
body="$(curl -fsS -X POST "$BASE/api/book" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg dt "$DATETIME" --arg name "$NAME" --arg email "$EMAIL" \
    --arg company "$COMPANY" --arg notes "E2E test booking — safe to delete" \
    --arg tz "America/Chicago" --arg tier "growth" \
    '{datetime:$dt,name:$name,email:$email,company:$company,notes:$notes,timezone:$tz,tier:$tier}')")" \
  || fail "request failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "booking POST did not return success"
BID="$(echo "$body" | jq -r '.booking_id // empty')"
[ -n "$BID" ] && [ "$BID" != "null" ] || fail "booking POST did not return booking_id"
pass "booking created (id=$BID)"

# ─────────────────────────────────────────────────────────────────────────────
echo "[3/7] POST /api/questionnaire — attach answers (with booking_id, audit C2)"
body="$(curl -fsS -X POST "$BASE/api/questionnaire" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg email "$EMAIL" --arg tier "growth" --arg bid "$BID" '{
    email:$email, tier:$tier, booking_id:$bid,
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
echo "[4/7] GET /api/admin — verify booking visible with questionnaire (Bearer auth)"
body="$(curl -fsS "$BASE/api/admin" -H "Authorization: Bearer $TOKEN")" \
  || fail "admin GET failed (check ADMIN_TOKEN)"
ID="$(echo "$body" | jq -r --arg email "$EMAIL" \
  '.bookings[] | select(.email==$email) | .id' | head -n1)"
[ -n "$ID" ] && [ "$ID" != "null" ] || fail "booking not found in admin view"
has_q="$(echo "$body" | jq -r --arg id "$ID" \
  '.bookings[] | select(.id==$id) | (.questionnaire != null and (.questionnaire|type)=="object")')"
[ "$has_q" = "true" ] || fail "booking $ID found but questionnaire not attached"
pass "booking visible in admin (id=$ID) with questionnaire attached"

# ─────────────────────────────────────────────────────────────────────────────
echo "[5/7] POST /api/admin-update — flip status to post_won (Bearer auth)"
body="$(curl -fsS -X POST "$BASE/api/admin-update" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$(jq -n --arg id "$ID" \
    '{id:$id, status:"post_won", admin_notes:"E2E test — status flipped by script"}')")" \
  || fail "admin-update failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "admin-update did not return success"
pass "status + notes updated"

# ─────────────────────────────────────────────────────────────────────────────
echo "[6/7] GET /api/availability — public availability endpoint"
body="$(curl -fsS "$BASE/api/availability")" || fail "availability GET failed"
echo "$body" | jq -e '.days_available | type == "array"' >/dev/null || fail "availability response missing days_available"
pass "availability endpoint responsive"

# ─────────────────────────────────────────────────────────────────────────────
echo "[7/7] POST /api/admin-delete — remove test booking (Bearer auth)"
body="$(curl -fsS -X POST "$BASE/api/admin-delete" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$(jq -n --arg id "$ID" '{id:$id}')")" \
  || fail "admin-delete failed"
echo "$body" | jq -e '.success == true' >/dev/null || fail "admin-delete did not return success"
pass "test booking deleted"

echo
echo "All steps passed."
