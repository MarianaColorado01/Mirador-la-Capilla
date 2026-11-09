-- Esquema de la base local (SQLite). Reglas del documento de requerimientos:
-- RN-02 el stock solo cambia con movimientos · RN-03 precio y costo congelados
-- RN-04 nada se borra · RN-06 facturas consecutivas · RN-01 una cuenta abierta por mesa

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('todo','mesero','barra','caja','dueno')),
  pin_hash        TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price       INTEGER NOT NULL CHECK (price > 0),
  cost        INTEGER NOT NULL CHECK (cost > 0),
  stock       INTEGER NOT NULL DEFAULT 0, -- caché: solo se toca junto a stock_movements
  min_stock   INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  image_url   TEXT,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type       TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste')),
  qty        INTEGER NOT NULL, -- con signo: + entra, − sale
  reason     TEXT,
  reference  TEXT,             -- 'ronda:12', 'compra:4', 'factura:129'
  user_id    INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tables (
  id     INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  zone   TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS accounts (
  id        INTEGER PRIMARY KEY,
  table_id  INTEGER NOT NULL REFERENCES tables(id),
  waiter_id INTEGER NOT NULL REFERENCES users(id),
  status    TEXT NOT NULL CHECK (status IN ('abierta','por_cobrar','pagada')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
-- RN-01: solo una cuenta no pagada por mesa
CREATE UNIQUE INDEX IF NOT EXISTS one_open_account_per_table
  ON accounts(table_id) WHERE status IN ('abierta','por_cobrar');

CREATE TABLE IF NOT EXISTS rounds (
  id         INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  number     INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('tomado','preparacion','listo','entregado')),
  taken_by   INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, number)
);

CREATE TABLE IF NOT EXISTS round_items (
  id             INTEGER PRIMARY KEY,
  round_id       INTEGER NOT NULL REFERENCES rounds(id),
  product_id     INTEGER NOT NULL REFERENCES products(id),
  qty            INTEGER NOT NULL CHECK (qty >= 1),
  unit_price     INTEGER NOT NULL, -- congelado (RN-03)
  unit_cost      INTEGER NOT NULL, -- congelado (RN-03)
  note           TEXT CHECK (note IS NULL OR length(note) <= 100),
  voided_at      TEXT,
  voided_by      INTEGER REFERENCES users(id),
  void_reason    TEXT,
  void_restocked INTEGER
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  round_id   INTEGER NOT NULL REFERENCES rounds(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY,
  number      INTEGER NOT NULL UNIQUE, -- consecutivo sin saltos (RN-06)
  account_id  INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
  subtotal    INTEGER NOT NULL,
  discount    INTEGER NOT NULL DEFAULT 0,
  tip_percent REAL NOT NULL DEFAULT 0,
  tip         INTEGER NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 0,
  tax         INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL,
  cashier_id  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  voided_at   TEXT,
  voided_by   INTEGER REFERENCES users(id),
  void_reason TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  method     TEXT NOT NULL CHECK (method IN ('efectivo','tarjeta','transferencia')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  received   INTEGER,
  change     INTEGER
);

CREATE TABLE IF NOT EXISTS suppliers (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  phone   TEXT,
  notes   TEXT,
  address TEXT,
  lat     REAL,
  lng     REAL,
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchases (
  id          INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  date        TEXT NOT NULL,
  total       INTEGER NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          INTEGER PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  unit_cost   INTEGER NOT NULL CHECK (unit_cost > 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id         INTEGER PRIMARY KEY,
  concept    TEXT NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  date       TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
