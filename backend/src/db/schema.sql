-- Skema PostgreSQL untuk Sirkasir POS.
-- Aman dijalankan berulang (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  label text
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text,
  pin_hash text,
  role text NOT NULL DEFAULT 'kasir',
  status text NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  outlet_id text,
  sort integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingredients (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit text DEFAULT 'pcs',
  cost_avg numeric DEFAULT 0,
  stock numeric DEFAULT 0,
  min_stock numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id text PRIMARY KEY,
  sku text,
  barcode text,
  name text NOT NULL,
  category_id text,
  price numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  image text,
  is_available boolean DEFAULT true,
  type text DEFAULT 'single',
  station text,
  modifier_groups jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS menu_items_category_idx ON menu_items (category_id);

CREATE TABLE IF NOT EXISTS recipes (
  id text PRIMARY KEY,
  menu_item_id text NOT NULL,
  ingredient_id text NOT NULL,
  qty numeric DEFAULT 0
);
CREATE INDEX IF NOT EXISTS recipes_menu_idx ON recipes (menu_item_id);
CREATE INDEX IF NOT EXISTS recipes_ingredient_idx ON recipes (ingredient_id);

CREATE TABLE IF NOT EXISTS dining_tables (
  id text PRIMARY KEY,
  name text NOT NULL,
  area text,
  seats integer DEFAULT 4,
  status text DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  order_no text,
  type text DEFAULT 'dine-in',
  table_id text,
  table_name text,
  guests integer DEFAULT 1,
  customer_id text,
  customer_name text,
  cashier_id text,
  cashier_name text,
  items jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'open',
  created_at text,
  updated_at text,
  closed_at text
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_table_idx ON orders (table_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  contact text,
  note text
);

CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text,
  note text,
  points integer DEFAULT 0,
  visits integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_visit text,
  point_history jsonb DEFAULT '[]'::jsonb,
  created_at text
);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id text PRIMARY KEY,
  po_no text,
  supplier_id text,
  supplier_name text,
  items jsonb DEFAULT '[]'::jsonb,
  total numeric DEFAULT 0,
  note text,
  status text DEFAULT 'draft',
  created_by text,
  created_at text,
  received_at text,
  received_by text
);

CREATE TABLE IF NOT EXISTS shifts (
  id text PRIMARY KEY,
  cashier_id text,
  cashier_name text,
  opening_cash numeric DEFAULT 0,
  note text,
  cash_movements jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'open',
  opened_at text,
  closed_at text,
  closed_by text,
  closing jsonb
);

CREATE TABLE IF NOT EXISTS opnames (
  id text PRIMARY KEY,
  opname_no text,
  items jsonb DEFAULT '[]'::jsonb,
  total_variance_value numeric DEFAULT 0,
  note text,
  created_by text,
  created_at text
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id text PRIMARY KEY,
  ingredient_id text,
  type text,
  qty numeric,
  ref text,
  user_id text,
  created_at text
);
CREATE INDEX IF NOT EXISTS stock_movements_ing_idx ON stock_movements (ingredient_id);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  invoice_no text,
  cashier_id text,
  cashier_name text,
  customer_id text,
  customer_name text,
  order_type text,
  order_id text,
  table_name text,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  promo_discount numeric DEFAULT 0,
  promos jsonb DEFAULT '[]'::jsonb,
  tax numeric DEFAULT 0,
  service_charge numeric DEFAULT 0,
  total numeric DEFAULT 0,
  cost_total numeric DEFAULT 0,
  profit numeric DEFAULT 0,
  payments jsonb DEFAULT '[]'::jsonb,
  paid numeric DEFAULT 0,
  change numeric DEFAULT 0,
  status text DEFAULT 'paid',
  created_at text,
  voided_at text,
  voided_by text,
  loyalty jsonb
);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON transactions (created_at);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);
CREATE INDEX IF NOT EXISTS transactions_customer_idx ON transactions (customer_id);

CREATE TABLE IF NOT EXISTS promos (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text DEFAULT 'percent',
  value numeric DEFAULT 0,
  active boolean DEFAULT true,
  code text DEFAULT '',
  min_subtotal numeric DEFAULT 0,
  max_discount numeric DEFAULT 0,
  member_only boolean DEFAULT false,
  days jsonb DEFAULT '[]'::jsonb,
  start_hour numeric,
  end_hour numeric,
  applies_to text DEFAULT 'all',
  buy_qty numeric DEFAULT 1,
  get_qty numeric DEFAULT 1,
  stackable boolean DEFAULT false,
  priority numeric DEFAULT 0,
  created_at text
);

CREATE TABLE IF NOT EXISTS counters (
  key text PRIMARY KEY,
  value integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  store_name text,
  address text,
  phone text,
  currency text DEFAULT 'IDR',
  tax_percent numeric DEFAULT 0,
  service_percent numeric DEFAULT 0,
  rounding numeric DEFAULT 0,
  loyalty jsonb DEFAULT '{}'::jsonb,
  footer_note text,
  CONSTRAINT settings_singleton CHECK (id = 1)
);
