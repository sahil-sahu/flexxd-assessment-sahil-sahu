# Flexxd pay-per-visit booking service

Node + Express, in-memory store. Users/venues seeded from `data/users.json` and `data/venues.json`; bookings kept in a `Map` keyed by redemption code.

    npm install
    npm start        # :3000
    npm test
    bash demo.sh     # curl walkthrough (server must be running)

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
