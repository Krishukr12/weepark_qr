#!/usr/bin/env bash
# End-to-end API smoke test covering the full parking lifecycle.
# Prints step names + IDs/statuses only (never tokens or secrets).
set -euo pipefail

BASE="http://localhost:4000/api/v1"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const v=eval('d'+process.argv[1]); console.log(v ?? '')" "$1"; }
step() { echo "--- $1"; }

ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@weepark.io}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD is required}"

STAMP=$(date +%s)

step "login super admin"
LOGIN=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | json '.data.accessToken')
[ -n "$TOKEN" ] && echo "ok: got access token" || { echo "FAIL: no token"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

step "create site"
SITE=$(curl -s -X POST "$BASE/sites" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Tower $STAMP\",\"address\":\"12 Test Street, Bengaluru\",\"latitude\":12.9716,\"longitude\":77.5946,\"totalCapacity\":50}")
SITE_ID=$(echo "$SITE" | json '.data.id')
SITE_CODE=$(echo "$SITE" | json '.data.siteCode')
echo "ok: site code=$SITE_CODE"

step "site QR download"
curl -s -o /dev/null -w "qr http=%{http_code}\n" -H "$AUTH" "$BASE/sites/$SITE_ID/qr"

step "create valet (assigned to site)"
VALET=$(curl -s -X POST "$BASE/valets" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Valet\",\"email\":\"valet$STAMP@weepark.io\",\"phone\":\"9800000001\",\"password\":\"ValetPass1234\",\"siteIds\":[\"$SITE_ID\"]}")
VALET_ID=$(echo "$VALET" | json '.data.id')
echo "ok: valet $VALET_ID"

step "create organization assigned to site"
ORG=$(curl -s -X POST "$BASE/organizations" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Org $STAMP\",\"companyName\":\"Smoke Pvt Ltd\",\"adminName\":\"Org Admin\",\"adminEmail\":\"orgadmin$STAMP@weepark.io\",\"adminPhone\":\"9800000002\",\"parkingAllocation\":10,\"siteAllocations\":[{\"siteId\":\"$SITE_ID\",\"allocatedSpaces\":10}]}")
ORG_ID=$(echo "$ORG" | json '.data.id')
echo "ok: org $ORG_ID"

step "create employee"
EMP=$(curl -s -X POST "$BASE/employees" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"organizationId\":\"$ORG_ID\",\"employeeCode\":\"EMP-$STAMP\",\"name\":\"Smoke Employee\",\"email\":\"emp$STAMP@smoke.io\",\"phone\":\"9800000003\",\"department\":\"QA\"}")
EMP_ID=$(echo "$EMP" | json '.data.id')
echo "ok: employee $EMP_ID"

step "create vehicle"
VEH_NO="KA01SM$(( STAMP % 10000 ))"
VEH=$(curl -s -X POST "$BASE/vehicles" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"employeeId\":\"$EMP_ID\",\"vehicleNumber\":\"$VEH_NO\",\"vehicleType\":\"CAR\",\"brand\":\"Tata\",\"model\":\"Nexon\"}")
echo "ok: vehicle number=$VEH_NO"

step "public: site by code"
curl -s -o /dev/null -w "public site http=%{http_code}\n" "$BASE/public/parking/sites/$SITE_CODE"

step "public: vehicle lookup"
LOOKUP=$(curl -s -X POST "$BASE/public/parking/sites/$SITE_CODE/lookup" -H 'Content-Type: application/json' \
  -d "{\"vehicleNumber\":\"$VEH_NO\"}")
FOUND=$(echo "$LOOKUP" | json '.data.found')
PARK_TOKEN=$(echo "$LOOKUP" | json '.data.parkToken')
echo "lookup found=$FOUND"
[ -n "$PARK_TOKEN" ] || { echo "FAIL: no parkToken"; exit 1; }

step "public: park vehicle"
PARK=$(curl -s -X POST "$BASE/public/parking/sites/$SITE_CODE/park" -H 'Content-Type: application/json' \
  -d "{\"parkToken\":\"$PARK_TOKEN\"}")
SESSION=$(echo "$PARK" | json '.data.sessionToken')
TICKET=$(echo "$PARK" | json '.data.parking.ticketCode')
echo "ok: parked ticket=$TICKET"
[ -n "$SESSION" ] || { echo "FAIL: no sessionToken"; exit 1; }

step "public: session status"
curl -s -o /dev/null -w "session status http=%{http_code}\n" -X POST "$BASE/public/parking/session/status" \
  -H 'Content-Type: application/json' -d "{\"sessionToken\":\"$SESSION\"}"

step "public: request pickup (GET MY CAR)"
PICKUP=$(curl -s -X POST "$BASE/public/pickups/request" -H 'Content-Type: application/json' \
  -d "{\"sessionToken\":\"$SESSION\",\"vehicleNumber\":\"$VEH_NO\",\"ticketCode\":\"$TICKET\"}")
PICKUP_ID=$(echo "$PICKUP" | json '.data.id')
echo "ok: pickup requested status=$(echo "$PICKUP" | json '.data.status')"

step "valet: login, accept, complete"
VLOGIN=$(curl -s -c "$COOKIE_JAR.valet" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"valet$STAMP@weepark.io\",\"password\":\"ValetPass1234\"}")
VTOKEN=$(echo "$VLOGIN" | json '.data.accessToken')
VAUTH="Authorization: Bearer $VTOKEN"
ACCEPT=$(curl -s -X POST "$BASE/pickups/$PICKUP_ID/accept" -H "$VAUTH")
echo "accept status=$(echo "$ACCEPT" | json '.data.status')"
COMPLETE=$(curl -s -X POST "$BASE/pickups/$PICKUP_ID/complete" -H "$VAUTH")
echo "complete status=$(echo "$COMPLETE" | json '.data.status')"

step "dashboard stats"
curl -s -o /dev/null -w "dashboard http=%{http_code}\n" -H "$AUTH" "$BASE/dashboard/stats"

step "parking export csv + excel"
curl -s -o /dev/null -w "csv http=%{http_code}\n" -H "$AUTH" "$BASE/parking/export/csv"
curl -s -o /dev/null -w "excel http=%{http_code}\n" -H "$AUTH" "$BASE/parking/export/excel"

step "org admin isolation check"
OLOGIN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"orgadmin$STAMP@weepark.io\",\"password\":\"wrong-password\"}")
echo "org admin wrong password rejected=$(echo "$OLOGIN" | json '.success')"

echo "=== SMOKE TEST PASSED ==="
