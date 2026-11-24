const crypto = require('node:crypto');
const express = require('express');
const { users, venues, bookings, persistUsers, CODE_TTL_MS } = require('./store');

const app = express();
app.use(express.json());

const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

function newCode() {
  let code;
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (bookings.has(code));
  return code;
}

app.post('/bookings', (req, res) => {
  const { userId, venueId } = req.body || {};
  if (!userId || !venueId) {
    return fail(res, 400, 'MISSING_FIELDS', 'userId and venueId are required');
  }
  const user = users.get(userId);
  if (!user) return fail(res, 404, 'USER_NOT_FOUND', `User ${userId} not found`);
  const venue = venues.get(venueId);
  if (!venue) return fail(res, 404, 'VENUE_NOT_FOUND', `Venue ${venueId} not found`);

  const now = Date.now();
  const hasActive = [...bookings.values()].some(
    (b) =>
      b.userId === userId &&
      b.venueId === venueId &&
      b.status === 'booked' &&
      Date.parse(b.expiresAt) > now
  );
  if (hasActive) {
    return fail(res, 409, 'DUPLICATE_BOOKING', 'User already has an active booking at this venue');
  }
  if (user.credits < 1) {
    return fail(res, 402, 'INSUFFICIENT_CREDITS', 'User has no visit credits left');
  }

  user.credits -= 1;
  persistUsers();
  const booking = {
    id: crypto.randomUUID(),
    userId,
    venueId,
    redemptionCode: newCode(),
    status: 'booked',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
    redeemedAt: null,
  };
  bookings.set(booking.redemptionCode, booking);
  res.status(201).json(booking);
});

app.post('/bookings/redeem', (req, res) => {
  const { code } = req.body || {};
  if (!code) return fail(res, 400, 'MISSING_FIELDS', 'code is required');
  const booking = bookings.get(String(code).toUpperCase());
  if (!booking) return fail(res, 404, 'CODE_NOT_FOUND', 'Redemption code not found');
  if (booking.status === 'redeemed') {
    return fail(res, 409, 'ALREADY_REDEEMED', 'Code has already been redeemed');
  }
  if (Date.parse(booking.expiresAt) <= Date.now()) {
    return fail(res, 410, 'CODE_EXPIRED', 'Redemption code has expired');
  }
  booking.status = 'redeemed';
  booking.redeemedAt = new Date().toISOString();
  res.json(booking);
});

app.get('/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return fail(res, 404, 'USER_NOT_FOUND', `User ${req.params.id} not found`);
  const userBookings = [...bookings.values()].filter((b) => b.userId === user.id);
  res.json({ ...user, bookings: userBookings });
});

module.exports = app;
