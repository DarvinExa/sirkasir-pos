const { hashPassword } = require('./auth');
const db = require('./db');
const { uid } = require('./utils');

function build() {
  const roles = [
    { id: 'role_owner', name: 'owner', label: 'Owner / Super Admin' },
    { id: 'role_kasir', name: 'kasir', label: 'Kasir' },
  ];

  const users = [
    {
      id: uid('usr'),
      name: 'Bu Sari',
      email: 'owner@sirkasir.test',
      password_hash: hashPassword('owner123'),
      pin_hash: hashPassword('1111'),
      role: 'owner',
      status: 'active',
    },
    {
      id: uid('usr'),
      name: 'Dewi',
      email: 'kasir@sirkasir.test',
      password_hash: hashPassword('kasir123'),
      pin_hash: hashPassword('2222'),
      role: 'kasir',
      status: 'active',
    },
  ];

  const cat = {
    makanan: { id: 'cat_makanan', name: 'Makanan', outlet_id: null, sort: 1 },
    minuman: { id: 'cat_minuman', name: 'Minuman', outlet_id: null, sort: 2 },
    snack: { id: 'cat_snack', name: 'Snack', outlet_id: null, sort: 3 },
  };
  const categories = Object.values(cat);

  const ing = {
    beras: { id: 'ing_beras', name: 'Beras', unit: 'gram', cost_avg: 12, stock: 50000, min_stock: 5000 },
    telur: { id: 'ing_telur', name: 'Telur', unit: 'butir', cost_avg: 2500, stock: 200, min_stock: 24 },
    minyak: { id: 'ing_minyak', name: 'Minyak Goreng', unit: 'ml', cost_avg: 20, stock: 10000, min_stock: 1000 },
    ayam: { id: 'ing_ayam', name: 'Ayam', unit: 'gram', cost_avg: 40, stock: 20000, min_stock: 2000 },
    teh: { id: 'ing_teh', name: 'Teh', unit: 'gram', cost_avg: 100, stock: 2000, min_stock: 200 },
    gula: { id: 'ing_gula', name: 'Gula', unit: 'gram', cost_avg: 15, stock: 10000, min_stock: 1000 },
    kopi: { id: 'ing_kopi', name: 'Kopi Bubuk', unit: 'gram', cost_avg: 150, stock: 3000, min_stock: 300 },
    mie: { id: 'ing_mie', name: 'Mie', unit: 'pcs', cost_avg: 3000, stock: 100, min_stock: 10 },
    es: { id: 'ing_es', name: 'Es Batu', unit: 'pcs', cost_avg: 200, stock: 500, min_stock: 50 },
    air: { id: 'ing_air', name: 'Air', unit: 'ml', cost_avg: 5, stock: 100000, min_stock: 5000 },
  };
  const ingredients = Object.values(ing);

  // Modifier groups dipakai ulang oleh beberapa menu
  const mgPedas = {
    id: 'mg_pedas',
    name: 'Level Pedas',
    required: true,
    multiple: false,
    options: [
      { id: 'op_pedas_normal', name: 'Normal', price: 0 },
      { id: 'op_pedas_pedas', name: 'Pedas', price: 0 },
      { id: 'op_pedas_extra', name: 'Extra Pedas', price: 2000 },
    ],
  };
  const mgTopping = {
    id: 'mg_topping',
    name: 'Tambahan',
    required: false,
    multiple: true,
    options: [
      { id: 'op_top_telur', name: 'Telur Ceplok', price: 3000 },
      { id: 'op_top_kerupuk', name: 'Kerupuk', price: 2000 },
      { id: 'op_top_ayam', name: 'Extra Ayam', price: 6000 },
    ],
  };
  const mgUkuran = {
    id: 'mg_ukuran',
    name: 'Ukuran',
    required: true,
    multiple: false,
    options: [
      { id: 'op_uk_reg', name: 'Regular', price: 0 },
      { id: 'op_uk_jumbo', name: 'Jumbo', price: 2000 },
    ],
  };
  const mgGula = {
    id: 'mg_gula',
    name: 'Gula',
    required: false,
    multiple: false,
    options: [
      { id: 'op_gula_normal', name: 'Normal', price: 0 },
      { id: 'op_gula_sedikit', name: 'Sedikit', price: 0 },
      { id: 'op_gula_tanpa', name: 'Tanpa Gula', price: 0 },
    ],
  };

  const rawMenu = [
    { id: 'menu_nasgor', name: 'Nasi Goreng Spesial', cat: 'makanan', price: 20000, recipe: [['beras', 150], ['telur', 1], ['minyak', 20], ['ayam', 50]], mods: [mgPedas, mgTopping] },
    { id: 'menu_miegor', name: 'Mie Goreng', cat: 'makanan', price: 18000, recipe: [['mie', 1], ['telur', 1], ['minyak', 20]], mods: [mgPedas, mgTopping] },
    { id: 'menu_ayamgor', name: 'Ayam Goreng', cat: 'makanan', price: 15000, recipe: [['ayam', 200], ['minyak', 30]], mods: [mgPedas] },
    { id: 'menu_nasput', name: 'Nasi Putih', cat: 'makanan', price: 5000, recipe: [['beras', 150]], mods: [] },
    { id: 'menu_esteh', name: 'Es Teh Manis', cat: 'minuman', price: 5000, recipe: [['teh', 5], ['gula', 15], ['es', 3], ['air', 250]], mods: [mgUkuran, mgGula] },
    { id: 'menu_tehpanas', name: 'Teh Panas', cat: 'minuman', price: 4000, recipe: [['teh', 5], ['gula', 15], ['air', 250]], mods: [mgGula] },
    { id: 'menu_eskopi', name: 'Es Kopi', cat: 'minuman', price: 8000, recipe: [['kopi', 15], ['gula', 15], ['es', 3], ['air', 200]], mods: [mgUkuran, mgGula] },
    { id: 'menu_kopipanas', name: 'Kopi Panas', cat: 'minuman', price: 7000, recipe: [['kopi', 15], ['gula', 15], ['air', 200]], mods: [mgGula] },
    { id: 'menu_pisgor', name: 'Pisang Goreng', cat: 'snack', price: 10000, recipe: [['minyak', 30]], mods: [] },
    { id: 'menu_kerupuk', name: 'Kerupuk', cat: 'snack', price: 2000, recipe: [], mods: [] },
  ];

  const menu_items = [];
  const recipes = [];
  let n = 0;
  for (const m of rawMenu) {
    n += 1;
    const cost = Math.round(m.recipe.reduce((s, [k, q]) => s + ing[k].cost_avg * q, 0));
    menu_items.push({
      id: m.id,
      sku: 'MNU-' + String(n).padStart(3, '0'),
      barcode: null,
      name: m.name,
      category_id: cat[m.cat].id,
      price: m.price,
      cost,
      image: null,
      is_available: true,
      type: 'single',
      station: m.cat === 'minuman' ? 'bar' : 'kitchen',
      modifier_groups: m.mods || [],
    });
    for (const [k, q] of m.recipe) {
      recipes.push({ id: uid('rcp'), menu_item_id: m.id, ingredient_id: ing[k].id, qty: q });
    }
  }

  // Meja / tables
  const tables = [
    { id: 'tbl_1', name: 'Meja 1', area: 'Indoor', seats: 4, status: 'available' },
    { id: 'tbl_2', name: 'Meja 2', area: 'Indoor', seats: 4, status: 'available' },
    { id: 'tbl_3', name: 'Meja 3', area: 'Indoor', seats: 2, status: 'available' },
    { id: 'tbl_4', name: 'Meja 4', area: 'Indoor', seats: 2, status: 'available' },
    { id: 'tbl_5', name: 'Meja 5', area: 'Outdoor', seats: 6, status: 'available' },
    { id: 'tbl_6', name: 'Meja 6', area: 'Outdoor', seats: 4, status: 'available' },
    { id: 'tbl_7', name: 'Meja 7', area: 'Outdoor', seats: 4, status: 'available' },
    { id: 'tbl_8', name: 'VIP 1', area: 'VIP', seats: 8, status: 'available' },
  ];

  const settings = {
    store_name: 'Sirkasir Resto',
    address: 'Jl. Melati No. 1, Denpasar, Bali',
    phone: '0812-0000-0000',
    currency: 'IDR',
    tax_percent: 0,
    service_percent: 0,
    rounding: 0,
    loyalty: { enabled: true, earn_per: 1000, point_value: 100 },
    footer_note: 'Terima kasih! Selamat menikmati!',
  };

  // Supplier
  const suppliers = [
    { id: 'sup_pangan', name: 'CV Sumber Pangan', phone: '0813-1111-2222', contact: 'Pak Joko', note: 'Beras, telur, ayam' },
    { id: 'sup_sayur', name: 'Toko Sayur Segar', phone: '0857-3333-4444', contact: 'Bu Ani', note: 'Minyak, gula, teh, kopi' },
  ];

  // Pelanggan / member loyalty
  const now = new Date().toISOString();
  const customers = [
    { id: 'cst_budi', name: 'Budi Santoso', phone: '0812-5555-1111', email: '', note: 'Langganan kopi pagi', points: 120, visits: 8, total_spent: 96000, last_visit: now, point_history: [], created_at: now },
    { id: 'cst_siti', name: 'Siti Aminah', phone: '0813-5555-2222', email: '', note: '', points: 40, visits: 3, total_spent: 41000, last_visit: now, point_history: [], created_at: now },
    { id: 'cst_rian', name: 'Rian Pratama', phone: '0821-5555-3333', email: '', note: 'Suka pedas', points: 0, visits: 0, total_spent: 0, last_visit: null, point_history: [], created_at: now },
  ];

  // Promo & diskon otomatis
  const promos = [
    { id: 'promo_diskon10', name: 'Diskon 10% (min. belanja 25rb)', type: 'percent', value: 10, active: true, code: '', min_subtotal: 25000, max_discount: 15000, member_only: false, days: [], start_hour: null, end_hour: null, applies_to: 'all', buy_qty: 1, get_qty: 1, stackable: false, priority: 1, created_at: now },
    { id: 'promo_happyhour', name: 'Happy Hour 20% (jam 15-18)', type: 'percent', value: 20, active: true, code: '', min_subtotal: 0, max_discount: 0, member_only: false, days: [], start_hour: 15, end_hour: 18, applies_to: 'all', buy_qty: 1, get_qty: 1, stackable: true, priority: 2, created_at: now },
    { id: 'promo_member5rb', name: 'Bonus Member Rp5.000 (min. 30rb)', type: 'fixed', value: 5000, active: true, code: '', min_subtotal: 30000, max_discount: 0, member_only: true, days: [], start_hour: null, end_hour: null, applies_to: 'all', buy_qty: 1, get_qty: 1, stackable: true, priority: 3, created_at: now },
    { id: 'promo_voucher', name: 'Voucher HEMAT15', type: 'percent', value: 15, active: true, code: 'HEMAT15', min_subtotal: 0, max_discount: 20000, member_only: false, days: [], start_hour: null, end_hour: null, applies_to: 'all', buy_qty: 1, get_qty: 1, stackable: false, priority: 5, created_at: now },
    { id: 'promo_bogo_esteh', name: 'Beli 2 Es Teh Gratis 1', type: 'bogo', value: 0, active: false, code: '', min_subtotal: 0, max_discount: 0, member_only: false, days: [], start_hour: null, end_hour: null, applies_to: 'menu_esteh', buy_qty: 2, get_qty: 1, stackable: false, priority: 4, created_at: now },
  ];

  return {
    schema_version: 5,
    roles,
    users,
    categories,
    ingredients,
    menu_items,
    recipes,
    tables,
    orders: [],
    suppliers,
    customers,
    purchase_orders: [],
    shifts: [],
    opnames: [],
    stock_movements: [],
    transactions: [],
    counters: {},
    promos,
    settings,
  };
}

db.writeRaw(build());
console.log('Database berhasil dibuat di:', db.DB_FILE);
console.log('   Login Owner  -> email: owner@sirkasir.test | password: owner123 | PIN: 1111');
console.log('   Login Kasir  -> email: kasir@sirkasir.test | password: kasir123 | PIN: 2222');
