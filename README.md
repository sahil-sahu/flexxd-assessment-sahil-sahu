# Flexxd pay-per-visit booking service

Node + Express, in-memory store. Users/venues seeded from `data/users.json` and `data/venues.json`; bookings kept in a `Map` keyed by redemption code.

    npm install
    npm start        # :3000
    npm test
    bash demo.sh     # curl walkthrough (server must be running)

## Try it with curl
Start the server (`npm start`), then:

```bash
B=http://localhost:3000; J='Content-Type: application/json'

# 1. Book a visit (201): deducts 1 credit, returns the booking with its redemptionCode
curl -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"v1"}'

# 2. Same user, same venue again (409 DUPLICATE_BOOKING)
curl -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"v1"}'

# 3. User with no credits (402 INSUFFICIENT_CREDITS)
curl -X POST $B/bookings -H "$J" -d '{"userId":"u2","venueId":"v1"}'

# 4. Unknown user / venue (404) and missing fields (400)
curl -X POST $B/bookings -H "$J" -d '{"userId":"ghost","venueId":"v1"}'
curl -X POST $B/bookings -H "$J" -d '{"userId":"u1","venueId":"ghost"}'
curl -X POST $B/bookings -H "$J" -d '{}'

# 5. Redeem: paste the redemptionCode from step 1 (200). Again: 409 ALREADY_REDEEMED
curl -X POST $B/bookings/redeem -H "$J" -d '{"code":"PASTE_CODE_HERE"}'
curl -X POST $B/bookings/redeem -H "$J" -d '{"code":"PASTE_CODE_HERE"}'

# 6. Unknown code (404 CODE_NOT_FOUND)
curl -X POST $B/bookings/redeem -H "$J" -d '{"code":"DEADBEEF"}'

# 7. User with current credits and all bookings (200); unknown user (404)
curl $B/users/u1
curl $B/users/ghost
```

Expired codes (410 `CODE_EXPIRED`) take 24h to occur, so that case is covered in `test/edge-cases.test.js`.
`bash demo.sh` runs the main calls in one go. Each real booking spends one of Alice's credits (saved in `data/users.json`).

## Assumptions
1. Users and venues already exist (seeded from JSON, no create endpoints).
2. The user knows the venue id.
3. Venues have no booking limit (`dailyCapacity` is not enforced).
4. Bookings are stored in a `Map`.
5. No API keys / auth.

Also: `pricePerVisit` is in credits and is 1 for every venue, matching the one-credit deduction per booking; a user can't book a venue they already have an active (unredeemed, unexpired) booking at; codes expire after 24h; no refund on expiry; user credits are persisted back to `data/users.json` after each booking (so they survive restarts), but bookings live in the in-memory `Map` and are lost on restart.

## Endpoints
- `POST /bookings` `{userId, venueId}` → 201 booking. Errors: 400, 404 `USER_NOT_FOUND`/`VENUE_NOT_FOUND`, 409 `DUPLICATE_BOOKING`, 402 `INSUFFICIENT_CREDITS`.
- `POST /bookings/redeem` `{code}` → 200 booking. Errors: 400, 404 `CODE_NOT_FOUND`, 409 `ALREADY_REDEEMED`, 410 `CODE_EXPIRED`.
- `GET /users/:id` → user with credits and bookings; 404 if missing.

Errors: `{ "error": { "code", "message" } }`.

## Docker
    docker build -t flexxd-booking .
    docker run -p 3000:3000 flexxd-booking
    # keep credits across container restarts:
    docker run -p 3000:3000 -v "$PWD/data:/app/data" flexxd-booking
