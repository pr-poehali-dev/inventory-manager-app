-- Склады
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Категории
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT NOT NULL DEFAULT '#6366f1'
);

-- Локации
CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    description TEXT,
    warehouse_id TEXT
);

-- Товары
CREATE TABLE IF NOT EXISTS public.items (
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

-- Операции
CREATE TABLE IF NOT EXISTS public.operations (
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
CREATE TABLE IF NOT EXISTS public.location_stocks (
    item_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, location_id)
);

-- Остатки по складам
CREATE TABLE IF NOT EXISTS public.warehouse_stocks (
    item_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, warehouse_id)
);

-- Партнёры
CREATE TABLE IF NOT EXISTS public.partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supplier', 'recipient')),
    contact TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Штрих-коды
CREATE TABLE IF NOT EXISTS public.barcodes (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    code TEXT NOT NULL,
    format TEXT,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заявки на сборку
CREATE TABLE IF NOT EXISTS public.work_orders (
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
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    required_qty INTEGER NOT NULL DEFAULT 0,
    picked_qty INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- Поступления
CREATE TABLE IF NOT EXISTS public.receipts (
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
    scan_history JSONB DEFAULT '[]',
    photo_url TEXT
);

-- Строки поступлений
CREATE TABLE IF NOT EXISTS public.receipt_lines (
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
CREATE TABLE IF NOT EXISTS public.tech_docs (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    doc_number TEXT,
    doc_date TEXT,
    doc_type TEXT NOT NULL,
    supplier TEXT,
    notes TEXT,
    custom_fields JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    cover_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Настройки
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO public.app_settings (key, value) VALUES
    ('darkMode', 'false'),
    ('defaultLowStockThreshold', '5'),
    ('currentUser', 'Администратор'),
    ('orderCounter', '3'),
    ('receiptCounter', '1'),
    ('taskCounter', '1')
ON CONFLICT (key) DO NOTHING;

-- Пользователи
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'warehouse', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Сессии
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT
);

-- Админ по умолчанию (логин: admin, пароль: admin123) — хеш создаётся при старте бэкенда

-- Индексы
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_item_id ON public.operations(item_id);
CREATE INDEX IF NOT EXISTS idx_operations_date ON public.operations(date DESC);
CREATE INDEX IF NOT EXISTS idx_location_stocks_item ON public.location_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_item ON public.warehouse_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_item ON public.barcodes(item_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_code ON public.barcodes(code);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON public.receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_tech_docs_item ON public.tech_docs(item_id);