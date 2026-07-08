// Koneksi PostgreSQL memakai connection pool dari driver "pg".
const { Pool, types } = require('pg');
const { loadEnv } = require('../loadEnv');

loadEnv();

// Secara default "pg" mengembalikan numeric & bigint sebagai string.
// Kita paksa jadi number JS supaya perhitungan di aplikasi tetap sama.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8/bigint

const connectionString = process.env.DATABASE_URL || '';
const wantSsl =
  process.env.PGSSL === 'true' || /sslmode=require/i.test(connectionString);
const ssl = wantSsl ? { rejectUnauthorized: false } : undefined;

const pool = connectionString
  ? new Pool({ connectionString, ssl })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'sirkasir',
      ssl,
    });

// Jalankan query. Kalau diberi client (dalam transaksi), pakai client itu.
function query(text, params, client) {
  return (client || pool).query(text, params || []);
}

// Bungkus beberapa operasi tulis dalam satu transaksi DB (BEGIN/COMMIT).
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
