// Tiny JSON-file database so the project runs with zero setup.
// To move to Firebase/MongoDB/Postgres later, replace the reads/writes of db.data.<collection>.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('./config');

const FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const COLLECTIONS = ['users', 'listings', 'orders', 'donations', 'notifications'];

const db = {
  data: {},
  id: () => crypto.randomUUID(),
  load() {
    try { this.data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { this.data = {}; }
    COLLECTIONS.forEach(c => { this.data[c] = this.data[c] || []; });
  },
  save() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, FILE);
  },
  reset() { COLLECTIONS.forEach(c => { this.data[c] = []; }); }
};

module.exports = db;
