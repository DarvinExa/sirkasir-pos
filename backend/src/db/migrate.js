// Membuat / memperbarui skema tabel di PostgreSQL.
// Jalankan: npm run migrate
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function main() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Skema PostgreSQL berhasil dibuat/diperbarui.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});
