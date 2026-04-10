
-- Миграция данных из монолитной таблицы app_state в отдельные таблицы
-- Выполняется один раз: извлекаем JSON-массивы из data и вставляем в соответствующие таблицы

-- Склады
INSERT INTO t_p45174738_inventory_manager_ap.warehouses (id, name, address, description, created_at)
SELECT
  w->>'id',
  w->>'name',
  w->>'address',
  w->>'description',
  COALESCE((w->>'createdAt')::timestamptz, NOW())
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'warehouses') AS w
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Категории
INSERT INTO t_p45174738_inventory_manager_ap.categories (id, name, parent_id, color)
SELECT
  c->>'id',
  c->>'name',
  c->>'parentId',
  COALESCE(c->>'color', '#6366f1')
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'categories') AS c
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Локации
INSERT INTO t_p45174738_inventory_manager_ap.locations (id, name, parent_id, description, warehouse_id)
SELECT
  l->>'id',
  l->>'name',
  l->>'parentId',
  l->>'description',
  l->>'warehouseId'
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'locations') AS l
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Партнёры
INSERT INTO t_p45174738_inventory_manager_ap.partners (id, name, type, contact, note, created_at)
SELECT
  p->>'id',
  p->>'name',
  p->>'type',
  p->>'contact',
  p->>'note',
  COALESCE((p->>'createdAt')::timestamptz, NOW())
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'partners') AS p
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Товары
INSERT INTO t_p45174738_inventory_manager_ap.items (id, name, category_id, location_id, description, unit, quantity, low_stock_threshold, image_url, created_at)
SELECT
  i->>'id',
  i->>'name',
  i->>'categoryId',
  i->>'locationId',
  i->>'description',
  COALESCE(i->>'unit', 'шт'),
  COALESCE((i->>'quantity')::int, 0),
  COALESCE((i->>'lowStockThreshold')::int, 5),
  i->>'imageUrl',
  COALESCE((i->>'createdAt')::timestamptz, NOW())
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'items') AS i
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Операции
INSERT INTO t_p45174738_inventory_manager_ap.operations (id, item_id, type, quantity, comment, from_place, to_place, performed_by, date, order_id, location_id, warehouse_id, scanned_codes)
SELECT
  o->>'id',
  o->>'itemId',
  o->>'type',
  COALESCE((o->>'quantity')::int, 0),
  o->>'comment',
  o->>'from',
  o->>'to',
  COALESCE(o->>'performedBy', ''),
  COALESCE((o->>'date')::timestamptz, NOW()),
  o->>'orderId',
  o->>'locationId',
  o->>'warehouseId',
  COALESCE(o->'scannedCodes', '[]'::jsonb)
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'operations') AS o
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Остатки по локациям
INSERT INTO t_p45174738_inventory_manager_ap.location_stocks (item_id, location_id, quantity)
SELECT
  ls->>'itemId',
  ls->>'locationId',
  COALESCE((ls->>'quantity')::int, 0)
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'locationStocks') AS ls
WHERE id = 1
ON CONFLICT (item_id, location_id) DO NOTHING;

-- Остатки по складам
INSERT INTO t_p45174738_inventory_manager_ap.warehouse_stocks (item_id, warehouse_id, quantity)
SELECT
  ws->>'itemId',
  ws->>'warehouseId',
  COALESCE((ws->>'quantity')::int, 0)
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'warehouseStocks') AS ws
WHERE id = 1
ON CONFLICT (item_id, warehouse_id) DO NOTHING;

-- Штрих-коды
INSERT INTO t_p45174738_inventory_manager_ap.barcodes (id, item_id, code, format, label, created_at)
SELECT
  b->>'id',
  b->>'itemId',
  b->>'code',
  b->>'format',
  b->>'label',
  COALESCE((b->>'createdAt')::timestamptz, NOW())
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'barcodes') AS b
WHERE id = 1 AND jsonb_array_length(data->'barcodes') > 0
ON CONFLICT (id) DO NOTHING;

-- Заявки на сборку
INSERT INTO t_p45174738_inventory_manager_ap.work_orders (id, number, title, status, created_by, recipient_id, recipient_name, created_at, updated_at, comment)
SELECT
  wo->>'id',
  wo->>'number',
  wo->>'title',
  COALESCE(wo->>'status', 'draft'),
  COALESCE(wo->>'createdBy', ''),
  wo->>'recipientId',
  wo->>'recipientName',
  COALESCE((wo->>'createdAt')::timestamptz, NOW()),
  COALESCE((wo->>'updatedAt')::timestamptz, NOW()),
  wo->>'comment'
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'workOrders') AS wo
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Позиции заявок
INSERT INTO t_p45174738_inventory_manager_ap.order_items (id, order_id, item_id, required_qty, picked_qty, status)
SELECT
  oi->>'id',
  wo->>'id',
  oi->>'itemId',
  COALESCE((oi->>'requiredQty')::int, 0),
  COALESCE((oi->>'pickedQty')::int, 0),
  COALESCE(oi->>'status', 'pending')
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'workOrders') AS wo,
     jsonb_array_elements(wo->'items') AS oi
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Поступления
INSERT INTO t_p45174738_inventory_manager_ap.receipts (id, number, status, supplier_id, supplier_name, warehouse_id, date, created_by, comment, total_amount, posted_at, custom_fields, scan_history)
SELECT
  r->>'id',
  r->>'number',
  COALESCE(r->>'status', 'draft'),
  r->>'supplierId',
  COALESCE(r->>'supplierName', ''),
  r->>'warehouseId',
  COALESCE((r->>'date')::timestamptz, NOW()),
  COALESCE(r->>'createdBy', ''),
  r->>'comment',
  (r->>'totalAmount')::numeric,
  (r->>'postedAt')::timestamptz,
  COALESCE(r->'customFields', '[]'::jsonb),
  COALESCE(r->'scanHistory', '[]'::jsonb)
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'receipts') AS r
WHERE id = 1 AND jsonb_array_length(data->'receipts') > 0
ON CONFLICT (id) DO NOTHING;

-- Строки поступлений
INSERT INTO t_p45174738_inventory_manager_ap.receipt_lines (id, receipt_id, item_id, item_name, qty, confirmed_qty, location_id, price, unit, is_new)
SELECT
  rl->>'id',
  r->>'id',
  rl->>'itemId',
  COALESCE(rl->>'itemName', ''),
  COALESCE((rl->>'qty')::int, 0),
  COALESCE((rl->>'confirmedQty')::int, 0),
  rl->>'locationId',
  (rl->>'price')::numeric,
  COALESCE(rl->>'unit', 'шт'),
  COALESCE((rl->>'isNew')::boolean, false)
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'receipts') AS r,
     jsonb_array_elements(r->'lines') AS rl
WHERE id = 1 AND jsonb_array_length(data->'receipts') > 0
ON CONFLICT (id) DO NOTHING;

-- Техническая документация
INSERT INTO t_p45174738_inventory_manager_ap.tech_docs (id, item_id, doc_number, doc_date, doc_type, supplier, notes, custom_fields, attachments, created_at, updated_at, created_by)
SELECT
  td->>'id',
  td->>'itemId',
  td->>'docNumber',
  td->>'docDate',
  COALESCE(td->>'docType', ''),
  td->>'supplier',
  td->>'notes',
  COALESCE(td->'customFields', '[]'::jsonb),
  COALESCE(td->'attachments', '[]'::jsonb),
  COALESCE((td->>'createdAt')::timestamptz, NOW()),
  COALESCE((td->>'updatedAt')::timestamptz, NOW()),
  COALESCE(td->>'createdBy', '')
FROM t_p45174738_inventory_manager_ap.app_state,
     jsonb_array_elements(data->'techDocs') AS td
WHERE id = 1 AND jsonb_array_length(data->'techDocs') > 0
ON CONFLICT (id) DO NOTHING;

-- Настройки
INSERT INTO t_p45174738_inventory_manager_ap.app_settings (key, value) VALUES
  ('darkMode', (SELECT COALESCE((data->>'darkMode')::text, 'false') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1)),
  ('defaultLowStockThreshold', (SELECT COALESCE(data->>'defaultLowStockThreshold', '5') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1)),
  ('currentUser', (SELECT COALESCE(data->>'currentUser', 'Администратор') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1)),
  ('orderCounter', (SELECT COALESCE(data->>'orderCounter', '3') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1)),
  ('receiptCounter', (SELECT COALESCE(data->>'receiptCounter', '1') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1)),
  ('taskCounter', (SELECT COALESCE(data->>'taskCounter', '1') FROM t_p45174738_inventory_manager_ap.app_state WHERE id = 1))
ON CONFLICT (key) DO NOTHING;
