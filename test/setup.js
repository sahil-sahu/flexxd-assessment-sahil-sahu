// Shared test setup: point the store at a temp copy of users.json so persistence
// never modifies the real seed file. Must be required BEFORE src/app or src/store.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SEED = path.join(__dirname, '..', 'data', 'users.json');
const TMP_USERS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flexxd-')), 'users.json');
fs.copyFileSync(SEED, TMP_USERS);
process.env.USERS_FILE = TMP_USERS;

const resetStore = () => {
  fs.copyFileSync(SEED, TMP_USERS);
  require('../src/store').reset();
};

module.exports = { resetStore, TMP_USERS };
