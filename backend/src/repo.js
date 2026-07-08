// Layer akses data: satu "repository" per tabel.
// Setiap fungsi mengembalikan objek JS biasa dengan bentuk yang sama seperti
// versi lama (berbasis file JSON), supaya logika route hampir tidak berubah.
const { pool, query, tx } = require('./db/pool');

// Buat repository generik untuk sebuah tabel.
// - columns: daftar kolom (urutannya dipakai saat insert/update).
// - jsonCols: kolom bertipe jsonb (perlu di-stringify saat menulis).
function makeRepo(table, columns, jsonCols = []) {
  const jset = new Set(jsonCols);
  const colList = columns.join(', ');

  function toParam(col, obj) {
    const v = obj[col];
    if (jset.has(col)) return JSON.stringify(v === undefined ? null : v);
    return v === undefined ? null : v;
  }

  return {
    table,
    columns,
    async all(client) {
      const { rows } = await query(`SELECT ${colList} FROM ${table}`, [], client);
      return rows;
    },
    async where(clause, params, client) {
      const { rows } = await query(
        `SELECT ${colList} FROM ${table} WHERE ${clause}`,
        params,
        client
      );
      return rows;
    },
    async find(id, client) {
      const { rows } = await query(
        `SELECT ${colList} FROM ${table} WHERE id = $1`,
        [id],
        client
      );
      return rows[0] || null;
    },
    async insert(obj, client) {
      const vals = columns.map((c) => toParam(c, obj));
      const ph = columns.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await query(
        `INSERT INTO ${table} (${colList}) VALUES (${ph}) RETURNING ${colList}`,
        vals,
        client
      );
      return rows[0];
    },
    async update(obj, client) {
      const setCols = columns.filter((c) => c !== 'id');
      const vals = setCols.map((c) => toParam(c, obj));
      const setSql = setCols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      vals.push(obj.id);
      const { rows } = await query(
        `UPDATE ${table} SET ${setSql} WHERE id = $${vals.length} RETURNING ${colList}`,
        vals,
        client
      );
      return rows[0];
    },
    async remove(id, client) {
      await query(`DELETE FROM ${table} WHERE id = $1`, [id], client);
      return { ok: true };
    },
    async deleteWhere(clause, params, client) {
      await query(`DELETE FROM ${table} WHERE ${clause}`, params, client);
      return { ok: true };
    },
  };
}

const roles = makeRepo('roles', ['id', 'name', 'label']);
const users = makeRepo('users', [
  'id', 'name', 'email', 'password_hash', 'pin_hash', 'role', 'status',
]);
const categories = makeRepo('categories', ['id', 'name', 'outlet_id', 'sort']);
const ingredients = makeRepo('ingredients', [
  'id', 'name', 'unit', 'cost_avg', 'stock', 'min_stock',
]);
const menuItems = makeRepo(
  'menu_items',
  [
    'id', 'sku', 'barcode', 'name', 'category_id', 'price', 'cost', 'image',
    'is_available', 'type', 'station', 'modifier_groups',
  ],
  ['modifier_groups']
);
const recipes = makeRepo('recipes', ['id', 'menu_item_id', 'ingredient_id', 'qty']);
const tables = makeRepo('dining_tables', ['id', 'name', 'area', 'seats', 'status']);
const orders = makeRepo(
  'orders',
  [
    'id', 'order_no', 'type', 'table_id', 'table_name', 'guests', 'customer_id',
    'customer_name', 'cashier_id', 'cashier_name', 'items', 'status',
    'created_at', 'updated_at', 'closed_at',
  ],
  ['items']
);
const suppliers = makeRepo('suppliers', ['id', 'name', 'phone', 'contact', 'note']);
const customers = makeRepo(
  'customers',
  [
    'id', 'name', 'phone', 'email', 'note', 'points', 'visits', 'total_spent',
    'last_visit', 'point_history', 'created_at',
  ],
  ['point_history']
);
const purchaseOrders = makeRepo(
  'purchase_orders',
  [
    'id', 'po_no', 'supplier_id', 'supplier_name', 'items', 'total', 'note',
    'status', 'created_by', 'created_at', 'received_at', 'received_by',
  ],
  ['items']
);
const shifts = makeRepo(
  'shifts',
  [
    'id', 'cashier_id', 'cashier_name', 'opening_cash', 'note', 'cash_movements',
    'status', 'opened_at', 'closed_at', 'closed_by', 'closing',
  ],
  ['cash_movements', 'closing']
);
const opnames = makeRepo(
  'opnames',
  ['id', 'opname_no', 'items', 'total_variance_value', 'note', 'created_by', 'created_at'],
  ['items']
);
const stockMovements = makeRepo('stock_movements', [
  'id', 'ingredient_id', 'type', 'qty', 'ref', 'user_id', 'created_at',
]);
const transactions = makeRepo(
  'transactions',
  [
    'id', 'invoice_no', 'cashier_id', 'cashier_name', 'customer_id',
    'customer_name', 'order_type', 'order_id', 'table_name', 'items', 'subtotal',
    'discount', 'promo_discount', 'promos', 'tax', 'service_charge', 'total',
    'cost_total', 'profit', 'payments', 'paid', 'change', 'status', 'created_at',
    'voided_at', 'voided_by', 'loyalty',
  ],
  ['items', 'promos', 'payments', 'loyalty']
);
const promos = makeRepo(
  'promos',
  [
    'id', 'name', 'type', 'value', 'active', 'code', 'min_subtotal',
    'max_discount', 'member_only', 'days', 'start_hour', 'end_hour',
    'applies_to', 'buy_qty', 'get_qty', 'stackable', 'priority', 'created_at',
  ],
  ['days']
);

// Nomor urut harian yang aman untuk transaksi bersamaan (atomic).
async function nextCounter(key, client) {
  const { rows } = await query(
    `INSERT INTO counters (key, value) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [key],
    client
  );
  return rows[0].value;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Bentuk nomor dokumen: PREFIX-YYYYMMDD-0001
async function counterNo(prefix, width, client) {
  const now = new Date();
  const key = prefix + '-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate());
  const value = await nextCounter(key, client);
  return key + '-' + String(value).padStart(width, '0');
}

const SETTINGS_COLS = [
  'store_name', 'address', 'phone', 'currency', 'tax_percent',
  'service_percent', 'rounding', 'loyalty', 'footer_note',
];

async function getSettings(client) {
  const { rows } = await query(
    `SELECT ${SETTINGS_COLS.join(', ')} FROM settings WHERE id = 1`,
    [],
    client
  );
  return rows[0] || null;
}

async function insertSettings(s, client) {
  const cols = ['id', ...SETTINGS_COLS];
  const vals = [
    1,
    ...SETTINGS_COLS.map((c) =>
      c === 'loyalty' ? JSON.stringify(s.loyalty || {}) : s[c] === undefined ? null : s[c]
    ),
  ];
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  await query(`INSERT INTO settings (${cols.join(', ')}) VALUES (${ph})`, vals, client);
}

async function updateSettings(patch, client) {
  const current = (await getSettings(client)) || {};
  const merged = { ...current, ...patch };
  const vals = SETTINGS_COLS.map((c) =>
    c === 'loyalty' ? JSON.stringify(merged.loyalty || {}) : merged[c] === undefined ? null : merged[c]
  );
  const setSql = SETTINGS_COLS.map((c, i) => `${c} = $${i + 1}`).join(', ');
  await query(`UPDATE settings SET ${setSql} WHERE id = 1`, vals, client);
  return getSettings(client);
}

module.exports = {
  pool,
  query,
  tx,
  roles,
  users,
  categories,
  ingredients,
  menuItems,
  recipes,
  tables,
  orders,
  suppliers,
  customers,
  purchaseOrders,
  shifts,
  opnames,
  stockMovements,
  transactions,
  promos,
  nextCounter,
  counterNo,
  getSettings,
  insertSettings,
  updateSettings,
};
