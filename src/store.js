// In-memory store. Users/venues are seeded from JSON at startup (never written back).
// Bookings live in a Map keyed by redemption code, so redeem is an O(1) lookup.
const fs = require('node:fs');
const path = require('node:path');

const CODE_TTL_MS = 24 * 60 * 60 * 1000; // one-day expiry

const DATA_DIR = path.join(__dirname, '..', 'data');
// USERS_FILE lets tests point at a temp copy so they never touch the real seed file.
const usersFile = () => process.env.USERS_FILE || path.join(DATA_DIR, 'users.json');
const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const users = new Map();
const venues = new Map();
const bookings = new Map();

function reset() {
  users.clear();
  venues.clear();
  bookings.clear();
  load(usersFile()).forEach((u) => users.set(u.id, { ...u }));
  load(path.join(DATA_DIR, 'venues.json')).forEach((v) => venues.set(v.id, { ...v }));
}

// Credits are persistent: write users back to users.json after every change.
// Write to a temp file then rename so a crash can't leave a half-written file.
function persistUsers() {
  const file = usersFile();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...users.values()], null, 2) + '\n');
  fs.renameSync(tmp, file);
}

reset();

module.exports = { users, venues, bookings, reset, persistUsers, CODE_TTL_MS };
