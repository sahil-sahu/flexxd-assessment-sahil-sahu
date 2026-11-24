const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup'); // first: sets USERS_FILE
const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

beforeEach(resetStore);

const book = (body) => request(app).post('/bookings').send(body);
const redeem = (body) => request(app).post('/bookings/redeem').send(body);
const expire = (code) => {
  store.bookings.get(code).expiresAt = new Date(Date.now() - 1000).toISOString();
};

describe('expiry', () => {
  test('expired code is rejected with 410 and stays unredeemed', async () => {
    const { body } = await book({ userId: 'u1', venueId: 'v1' });
    expire(body.redemptionCode);
    const res = await redeem({ code: body.redemptionCode });
    assert.strictEqual(res.status, 410);
    assert.strictEqual(res.body.error.code, 'CODE_EXPIRED');
    const stored = store.bookings.get(body.redemptionCode);
    assert.strictEqual(stored.status, 'booked');
    assert.strictEqual(stored.redeemedAt, null);
  });

  test('code expiring exactly now is rejected', async () => {
    const { body } = await book({ userId: 'u1', venueId: 'v1' });
    store.bookings.get(body.redemptionCode).expiresAt = new Date().toISOString();
    assert.strictEqual((await redeem({ code: body.redemptionCode })).status, 410);
  });

  test('new booking expires 24h after creation', async () => {
    const { body } = await book({ userId: 'u1', venueId: 'v1' });
    const ms = Date.parse(body.expiresAt) - Date.parse(body.createdAt);
    assert.strictEqual(ms, 24 * 60 * 60 * 1000);
  });

  test('expired booking does not block rebooking the same venue, no refund', async () => {
    const first = await book({ userId: 'u1', venueId: 'v1' });
    expire(first.body.redemptionCode);
    const second = await book({ userId: 'u1', venueId: 'v1' });
    assert.strictEqual(second.status, 201);
    assert.notStrictEqual(second.body.redemptionCode, first.body.redemptionCode);
    assert.strictEqual(store.users.get('u1').credits, 1); // 3 - 2, expired credit not refunded
  });
});

describe('no credits', () => {
  test('user with 0 credits gets 402, nothing created, credits stay 0', async () => {
    const res = await book({ userId: 'u2', venueId: 'v1' });
    assert.strictEqual(res.status, 402);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_CREDITS');
    assert.strictEqual(store.users.get('u2').credits, 0);
    assert.strictEqual(store.bookings.size, 0);
  });

  test('user runs out after spending all credits', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await book({ userId: 'u1', venueId: 'v1' });
      assert.strictEqual(r.status, 201);
      await redeem({ code: r.body.redemptionCode }); // free the venue for the next booking
    }
    assert.strictEqual(store.users.get('u1').credits, 0);
    const res = await book({ userId: 'u1', venueId: 'v2' });
    assert.strictEqual(res.status, 402);
    assert.strictEqual(store.users.get('u1').credits, 0); // never negative
    assert.strictEqual(store.bookings.size, 3);
  });
});

describe('invalid ids and input', () => {
  test('unknown user -> 404 USER_NOT_FOUND, no credit change', async () => {
    const res = await book({ userId: 'ghost', venueId: 'v1' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'USER_NOT_FOUND');
    assert.strictEqual(store.bookings.size, 0);
  });

  test('unknown venue -> 404 VENUE_NOT_FOUND, credit not deducted', async () => {
    const res = await book({ userId: 'u1', venueId: 'ghost' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'VENUE_NOT_FOUND');
    assert.strictEqual(store.users.get('u1').credits, 3);
  });

  test('both unknown -> 404', async () => {
    assert.strictEqual((await book({ userId: 'x', venueId: 'y' })).status, 404);
  });

  for (const [name, body] of [
    ['empty body', {}],
    ['missing venueId', { userId: 'u1' }],
    ['missing userId', { venueId: 'v1' }],
    ['empty strings', { userId: '', venueId: '' }],
  ]) {
    test(`booking with ${name} -> 400 MISSING_FIELDS`, async () => {
      const res = await book(body);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'MISSING_FIELDS');
    });
  }

  test('no body at all -> 400', async () => {
    assert.strictEqual((await request(app).post('/bookings')).status, 400);
  });

  test('wrong-typed ids (number, object, array) -> 404, no crash', async () => {
    for (const bad of [123, { a: 1 }, ['u1']]) {
      const res = await book({ userId: bad, venueId: 'v1' });
      assert.strictEqual(res.status, 404);
    }
    assert.strictEqual(store.users.get('u1').credits, 3);
  });

  test('prototype-ish ids are just unknown ids', async () => {
    assert.strictEqual((await book({ userId: '__proto__', venueId: 'v1' })).status, 404);
  });

  test('redeem: missing code -> 400, unknown code -> 404, wrong type -> 404', async () => {
    assert.strictEqual((await redeem({})).status, 400);
    assert.strictEqual((await redeem({ code: 'DEADBEEF' })).status, 404);
    assert.strictEqual((await redeem({ code: { x: 1 } })).status, 404);
  });

  test('GET unknown user -> 404 USER_NOT_FOUND', async () => {
    const res = await request(app).get('/users/ghost');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'USER_NOT_FOUND');
  });
});
