const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function load() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error('Database belum dibuat. Jalankan dulu: npm run seed');
  }
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return db;
}

function get() {
  if (!db) load();
  return db;
}

function save() {
  if (!db) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function writeRaw(data) {
  db = data;
  save();
}

module.exports = { get, load, save, writeRaw, DB_FILE, DATA_DIR };
