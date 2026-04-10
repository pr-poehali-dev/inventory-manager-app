
-- Склады
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Категории
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1'
);

-- Локации (полки/стеллажи)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  description TEXT,
  warehouse_id TEXT
);

-- Товары (номенклатура)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT,
  location_id TEXT,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'шт',
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Операции (приход/расход)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.operations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity INTEGER NOT NULL,
  comment TEXT,
  from_place TEXT,
  to_place TEXT,
  performed_by TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_id TEXT,
  location_id TEXT,
  warehouse_id TEXT,
  scanned_codes JSONB DEFAULT '[]'
);

-- Остатки по локациям
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.location_stocks (
  item_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, location_id)
);

-- Остатки по складам
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.warehouse_stocks (
  item_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, warehouse_id)
);

-- Партнёры (поставщики/получатели)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('supplier', 'recipient')),
  contact TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Штрих-коды
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.barcodes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  code TEXT NOT NULL,
  format TEXT,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заявки на сборку (work orders)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.work_orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT
);

-- Позиции заявок
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  required_qty INTEGER NOT NULL DEFAULT 0,
  picked_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Поступления (receipts)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.receipts (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  supplier_id TEXT,
  supplier_name TEXT NOT NULL,
  warehouse_id TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  comment TEXT,
  total_amount NUMERIC,
  posted_at TIMESTAMPTZ,
  custom_fields JSONB DEFAULT '[]',
  scan_history JSONB DEFAULT '[]'
);

-- Строки поступлений
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.receipt_lines (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  confirmed_qty INTEGER NOT NULL DEFAULT 0,
  location_id TEXT,
  price NUMERIC,
  unit TEXT NOT NULL DEFAULT 'шт',
  is_new BOOLEAN DEFAULT FALSE
);

-- Техническая документация
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.tech_docs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  doc_number TEXT,
  doc_date TEXT,
  doc_type TEXT NOT NULL,
  supplier TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Настройки приложения (скалярные значения)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO t_p45174738_inventory_manager_ap.app_settings (key, value) VALUES
  ('darkMode', 'false'),
  ('defaultLowStockThreshold', '5'),
  ('currentUser', 'Администратор'),
  ('orderCounter', '3'),
  ('receiptCounter', '1'),
  ('taskCounter', '1')
ON CONFLICT (key) DO NOTHING;

-- Индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_operations_item_id ON t_p45174738_inventory_manager_ap.operations(item_id);
CREATE INDEX IF NOT EXISTS idx_operations_date ON t_p45174738_inventory_manager_ap.operations(date DESC);
CREATE INDEX IF NOT EXISTS idx_location_stocks_item ON t_p45174738_inventory_manager_ap.location_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_item ON t_p45174738_inventory_manager_ap.warehouse_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_item ON t_p45174738_inventory_manager_ap.barcodes(item_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_code ON t_p45174738_inventory_manager_ap.barcodes(code);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON t_p45174738_inventory_manager_ap.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON t_p45174738_inventory_manager_ap.receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_tech_docs_item ON t_p45174738_inventory_manager_ap.tech_docs(item_id);
