#!/usr/bin/env bash
# Start the server first (port 3000 was taken on this machine, so default here is 3001):
#   PORT=3001 npm start
# Override the target with: BASE=http://host:port bash demo.sh
B=${BASE:-http://localhost:3001}
J='Content-Type: application/json'
post() { curl -s -w ' [%{http_code}]\n' -X POST "$B$1" -H "$J" -d "$2"; }

echo "--- 1. book u1 @ v1 (201)"
R=$(curl -s -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"v1"}'); echo "$R"
CODE=$(echo "$R" | sed -E 's/.*"redemptionCode":"([^"]+)".*/\1/')
echo "--- 2. duplicate booking, same venue (409)"; post /bookings '{"userId":"u1","venueId":"v1"}'
echo "--- 3. no credits (402)";                    post /bookings '{"userId":"u2","venueId":"v1"}'
echo "--- 4. unknown user (404)";                  post /bookings '{"userId":"ghost","venueId":"v1"}'
echo "--- 5. unknown venue (404)";                 post /bookings '{"userId":"u1","venueId":"ghost"}'
echo "--- 6. missing fields (400)";                post /bookings '{}'
echo "--- 7. redeem (200)";                        post /bookings/redeem "{\"code\":\"$CODE\"}"
echo "--- 8. redeem again (409)";                  post /bookings/redeem "{\"code\":\"$CODE\"}"
echo "--- 9. unknown code (404)";                  post /bookings/redeem '{"code":"DEADBEEF"}'
echo "--- 10. user u1 with credits and bookings (200)"; curl -s -w ' [%{http_code}]\n' $B/users/u1
echo "--- 11. unknown user (404)";                 curl -s -w ' [%{http_code}]\n' $B/users/ghost
