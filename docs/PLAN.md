# Flexxd pay-per-visit booking service — plan

## Context
Flexxd assessment: build a small Node.js + Express booking service with an in-memory store.
Users have visit credits, book a visit at a venue (gets a redemption code), and redeem it on arrival.
`/home/sahil/work/flexxd` is empty except `context/` (brief PDF + empty `asssumption.txt`).

User-specified constraints:
- Seed data from JSON files: `data/users.json`, `data/venues.json` (2 objects each), loaded into memory at startup (not written back).
- Bookings stored in a JS `Map`.
- Each booking deducts exactly one credit.
- A user cannot book the same venue again while they already hold an active booking there.

## Files (project root = /home/sahil/work/flexxd)
- `package.json`: `express` dep; dev deps `supertest`; scripts `start` (node src/server.js), `test` (node --test).
- `data/users.json`: `[{id:"u1",name:"Alice",credits:3},{id:"u2",name:"Bob",credits:0}]` (Bob has 0 credits so the rejection path is easy to demo).
- `data/venues.json`: `[{id:"v1",name:"Iron Gym",pricePerVisit:15,dailyCapacity:20},{id:"v2",name:"Zen Yoga",pricePerVisit:10,dailyCapacity:10}]`.
- `src/store.js`: loads the JSON into `users` and `venues` Maps keyed by id, plus `bookings = new Map()` keyed by **redemption code**, so redeem is an O(1) lookup. Exports a `reset()` for tests.
- `src/app.js`: builds and exports the Express app with the routes below (so tests can use it without listening on a port).
- `src/server.js`: `app.listen(PORT || 3000)`.
- `test/bookings.test.js`: `node:test` + supertest.
- `demo.sh`: curl walkthrough of the happy path and the error paths.
- `README.md`: how to run, the assumptions, endpoints and error codes.

## Booking shape
`{ id, userId, venueId, redemptionCode, status: "booked"|"redeemed", createdAt, expiresAt, redeemedAt }`
- `id`: `crypto.randomUUID()`; `redemptionCode`: 8-char uppercase from `crypto.randomBytes`, regenerated if it collides.
- `expiresAt = createdAt + 24 h` (one-day expiry; the user chose this over the brief's 10-minute bonus). Kept as a constant `CODE_TTL_MS = 24*60*60*1000` in `src/store.js`.

## Endpoints
**POST /bookings** `{userId, venueId}`. Checks run in this order and nothing changes until every check passes:
1. missing fields → 400
2. user not found → 404 `USER_NOT_FOUND`; venue not found → 404 `VENUE_NOT_FOUND`
3. user has an active booking at this venue (status `booked` and not expired) → 409 `DUPLICATE_BOOKING`
4. `credits < 1` → 402 `INSUFFICIENT_CREDITS`
5. deduct 1 credit, add the booking to the Map → 201 with the booking

No capacity check: per assumption 3, venues have no booking limit. `dailyCapacity` stays in the seed data only because the brief's data model includes it.

**POST /bookings/redeem** `{code}`: missing → 400; not found → 404; already redeemed → 409 `ALREADY_REDEEMED`; past `expiresAt` → 410 `CODE_EXPIRED`. Otherwise set `status="redeemed"`, `redeemedAt=now` → 200.

**GET /users/:id**: 404 if not found; else `{...user, bookings: [...bookings.values()].filter(b => b.userId === id)}`.

Errors share one shape: `{ error: { code, message } }`.

## Assumptions
These come from the user's `context/asssumption.txt`, which I won't edit:
1. Users and venues already exist (seeded from JSON, no create endpoints).
2. The user knows the venue id.
3. Venues have no booking limit, so capacity is not enforced.
4. Bookings are kept in a `Map`.
5. No API keys or auth.

Implementation notes (README only):
- Every booking costs 1 credit whatever the venue's price.
- "Already booked" means an unredeemed, unexpired booking at that venue. After it is redeemed or expires, the user can book that venue again.
- Credits are not refunded on expiry. State is lost on restart.

## Verification
- `npm install && npm test`. Tests cover: booking success deducts a credit; 0 credits → 402; unknown user/venue → 404; duplicate → 409; redeem success; redeem twice → 409; unknown code → 404; expired code → 410 (by moving `expiresAt` back on the stored booking); GET user includes bookings.
- `npm start` then `bash demo.sh` to show it working with curl.
- Commit in steps: scaffold + assumptions → store/seed → endpoints → tests/demo.
