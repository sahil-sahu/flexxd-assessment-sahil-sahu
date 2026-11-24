#!/usr/bin/env bash
# Run `npm start` in another terminal first.
B=${BASE:-http://localhost:3000}
J='Content-Type: application/json'
echo "--- book u1 @ v1";           R=$(curl -s -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"v1"}'); echo "$R"
CODE=$(echo "$R" | sed -E 's/.*"redemptionCode":"([^"]+)".*/\1/')
echo "--- duplicate (409)";        curl -s -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"v1"}'; echo
echo "--- no credits (402)";       curl -s -X POST $B/bookings -H "$J" -d '{"userId":"u2","venueId":"v1"}'; echo
echo "--- unknown venue (404)";    curl -s -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"x"}'; echo
echo "--- redeem";                 curl -s -X POST $B/bookings/redeem -H "$J" -d "{\"code\":\"$CODE\"}"; echo
echo "--- redeem again (409)";     curl -s -X POST $B/bookings/redeem -H "$J" -d "{\"code\":\"$CODE\"}"; echo
echo "--- unknown code (404)";     curl -s -X POST $B/bookings/redeem -H "$J" -d '{"code":"NOPE"}'; echo
echo "--- user u1";                curl -s $B/users/u1; echo
