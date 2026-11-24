const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Use a temp copy of users.json so persistence never modifies the real seed file.
const SEED = path.join(__dirname, '..', 'data', 'users.json');
const TMP_USERS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flexxd-')), 'users.json');
fs.copyFileSync(SEED, TMP_USERS);
process.env.USERS_FILE = TMP_USERS;
const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

beforeEach(() => {
  fs.copyFileSync(SEED, TMP_USERS);
  store.reset();
});

const book = (userId, venueId) => request(app).post('/bookings').send({ userId, venueId });

test('booking deducts exactly one credit and returns a code', async () => {
  const res = await book('u1', 'v1');
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.redemptionCode);
  assert.strictEqual(store.users.get('u1').credits, 2);
});

test('rejects user with no credits (402)', async () => {
  const res = await book('u2', 'v1');
  assert.strictEqual(res.status, 402);
  assert.strictEqual(res.body.error.code, 'INSUFFICIENT_CREDITS');
});

test('unknown user / venue return 404', async () => {
  assert.strictEqual((await book('nope', 'v1')).status, 404);
  assert.strictEqual((await book('u1', 'nope')).status, 404);
});

test('same user cannot book same venue twice, no credit taken', async () => {
  await book('u1', 'v1');
  const res = await book('u1', 'v1');
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.error.code, 'DUPLICATE_BOOKING');
  assert.strictEqual(store.users.get('u1').credits, 2);
  assert.strictEqual((await book('u1', 'v2')).status, 201);
});

test('can rebook after redeeming', async () => {
  const { body } = await book('u1', 'v1');
  await request(app).post('/bookings/redeem').send({ code: body.redemptionCode });
  assert.strictEqual((await book('u1', 'v1')).status, 201);
});

test('redeem works once, then 409; unknown code 404', async () => {
  const { body } = await book('u1', 'v1');
  const ok = await request(app).post('/bookings/redeem').send({ code: body.redemptionCode });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.status, 'redeemed');
  const again = await request(app).post('/bookings/redeem').send({ code: body.redemptionCode });
  assert.strictEqual(again.status, 409);
  const missing = await request(app).post('/bookings/redeem').send({ code: 'ZZZZZZZZ' });
  assert.strictEqual(missing.status, 404);
});

test('expired code is rejected (410)', async () => {
  const { body } = await book('u1', 'v1');
  store.bookings.get(body.redemptionCode).expiresAt = new Date(Date.now() - 1000).toISOString();
  const res = await request(app).post('/bookings/redeem').send({ code: body.redemptionCode });
  assert.strictEqual(res.status, 410);
});

test('GET /users/:id returns credits and bookings; 404 if missing', async () => {
  await book('u1', 'v1');
  const res = await request(app).get('/users/u1');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.credits, 2);
  assert.strictEqual(res.body.bookings.length, 1);
  assert.strictEqual((await request(app).get('/users/nope')).status, 404);
});

test('credit deduction is persisted to the users file', async () => {
  await book('u1', 'v1');
  const saved = JSON.parse(fs.readFileSync(TMP_USERS, 'utf8'));
  assert.strictEqual(saved.find((u) => u.id === 'u1').credits, 2);
  store.reset(); // simulates a restart: reload from disk
  assert.strictEqual(store.users.get('u1').credits, 2);
});
