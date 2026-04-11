"""
Локальный backend-сервер для docker-compose.
Поддерживает CRUD API для гранулярных операций + legacy state API.
"""

import json
import os
import re
import uuid
import urllib.request
from datetime import datetime, date, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import bcrypt

app = Flask(__name__)
CORS(app)

SCHEMA = os.environ.get("DB_SCHEMA", "public")

# ── camelCase <-> snake_case ─────────────────────────────────────────────────

CAMEL_TO_SNAKE_SPECIAL = {"from": "from_place", "to": "to_place"}
SNAKE_TO_CAMEL_SPECIAL = {"from_place": "from", "to_place": "to"}

def _camel_to_snake(name):
    if name in CAMEL_TO_SNAKE_SPECIAL:
        return CAMEL_TO_SNAKE_SPECIAL[name]
    return re.sub(r"([A-Z])", r"_\1", name).lower()

def _snake_to_camel(name):
    if name in SNAKE_TO_CAMEL_SPECIAL:
        return SNAKE_TO_CAMEL_SPECIAL[name]
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

def _row_to_camel(row):
    return {_snake_to_camel(k): v for k, v in row.items()}

def _body_to_snake(data):
    return {_camel_to_snake(k): v for k, v in data.items()}

def _json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def _json_dumps(data):
    return json.dumps(data, default=_json_serial, ensure_ascii=False)


# ── DB helpers ───────────────────────────────────────────────────────────────

def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    return conn

def _table(name):
    return f"{SCHEMA}.{name}"

def _fetch_all(cur, table, order_by="id"):
    cur.execute(f"SELECT * FROM {_table(table)} ORDER BY {order_by}")
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def _fetch_by(cur, table, where_col, where_val):
    cur.execute(f"SELECT * FROM {_table(table)} WHERE {where_col} = %s", (where_val,))
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def _upsert(cur, table, data, pk_cols):
    if not data:
        return
    cols = list(data.keys())
    vals = [json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in data.values()]
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    conflict_cols = ", ".join(pk_cols)
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c not in pk_cols)
    if update_set:
        sql = (f"INSERT INTO {_table(table)} ({col_list}) VALUES ({placeholders}) "
               f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_set}")
    else:
        sql = (f"INSERT INTO {_table(table)} ({col_list}) VALUES ({placeholders}) "
               f"ON CONFLICT ({conflict_cols}) DO NOTHING")
    cur.execute(sql, vals)

def _delete(cur, table, pk_col, pk_val):
    cur.execute(f"DELETE FROM {_table(table)} WHERE {pk_col} = %s", (pk_val,))

def _delete_multi(cur, table, where_col, where_val):
    cur.execute(f"DELETE FROM {_table(table)} WHERE {where_col} = %s", (where_val,))

def _truncate(cur, table):
    cur.execute(f"DELETE FROM {_table(table)}")


# ── Table definitions ────────────────────────────────────────────────────────

TABLE_COLUMNS = {
    "warehouses": ["id", "name", "address", "description", "created_at"],
    "categories": ["id", "name", "parent_id", "color"],
    "locations": ["id", "name", "parent_id", "description", "warehouse_id"],
    "items": ["id", "name", "category_id", "location_id", "description", "unit",
              "quantity", "low_stock_threshold", "image_url", "created_at", "attachments"],
    "operations": ["id", "item_id", "type", "quantity", "comment", "from_place",
                    "to_place", "performed_by", "date", "order_id", "location_id",
                    "warehouse_id", "scanned_codes"],
    "location_stocks": ["item_id", "location_id", "quantity"],
    "warehouse_stocks": ["item_id", "warehouse_id", "quantity"],
    "partners": ["id", "name", "type", "contact", "note", "created_at"],
    "barcodes": ["id", "item_id", "code", "format", "label", "created_at"],
    "work_orders": ["id", "number", "title", "status", "created_by", "recipient_id",
                     "recipient_name", "created_at", "updated_at", "comment"],
    "order_items": ["id", "order_id", "item_id", "required_qty", "picked_qty", "status"],
    "receipts": ["id", "number", "status", "supplier_id", "supplier_name", "warehouse_id",
                  "date", "created_by", "comment", "total_amount", "posted_at",
                  "custom_fields", "scan_history", "photo_url"],
    "receipt_lines": ["id", "receipt_id", "item_id", "item_name", "qty", "confirmed_qty",
                       "location_id", "price", "unit", "is_new"],
    "tech_docs": ["id", "item_id", "doc_number", "doc_date", "doc_type", "supplier",
                   "notes", "custom_fields", "attachments", "cover_url", "created_at", "updated_at",
                   "created_by"],
    "app_settings": ["key", "value"],
}

TABLE_PKS = {
    "warehouses": ["id"], "categories": ["id"], "locations": ["id"],
    "items": ["id"], "operations": ["id"],
    "location_stocks": ["item_id", "location_id"],
    "warehouse_stocks": ["item_id", "warehouse_id"],
    "partners": ["id"], "barcodes": ["id"], "work_orders": ["id"],
    "order_items": ["id"], "receipts": ["id"], "receipt_lines": ["id"],
    "tech_docs": ["id"], "app_settings": ["key"],
}

TRUNCATE_ORDER = [
    "order_items", "receipt_lines", "operations", "barcodes",
    "location_stocks", "warehouse_stocks",
    "work_orders", "receipts", "tech_docs",
    "items", "locations", "categories", "warehouses", "partners",
    "app_settings",
]

SETTINGS_KEYS = {
    "darkMode": ("darkMode", lambda v: v.lower() == "true" if v else False),
    "defaultLowStockThreshold": ("defaultLowStockThreshold", lambda v: int(v) if v else 5),
    "currentUser": ("currentUser", lambda v: v if v else ""),
    "orderCounter": ("orderCounter", lambda v: int(v) if v else 0),
    "receiptCounter": ("receiptCounter", lambda v: int(v) if v else 0),
    "taskCounter": ("taskCounter", lambda v: int(v) if v else 0),
}


def _prepare_row(table, camel_data):
    snake = _body_to_snake(camel_data)
    valid_cols = set(TABLE_COLUMNS.get(table, []))
    return {k: v for k, v in snake.items() if k in valid_cols}


# ── Load all ─────────────────────────────────────────────────────────────────

def _load_all(cur):
    items = [_row_to_camel(r) for r in _fetch_all(cur, "items", "created_at")]
    categories = [_row_to_camel(r) for r in _fetch_all(cur, "categories", "id")]
    locations = [_row_to_camel(r) for r in _fetch_all(cur, "locations", "id")]
    operations = [_row_to_camel(r) for r in _fetch_all(cur, "operations", "date")]
    warehouses = [_row_to_camel(r) for r in _fetch_all(cur, "warehouses", "created_at")]
    partners = [_row_to_camel(r) for r in _fetch_all(cur, "partners", "created_at")]
    barcodes = [_row_to_camel(r) for r in _fetch_all(cur, "barcodes", "created_at")]
    location_stocks = [_row_to_camel(r) for r in _fetch_all(cur, "location_stocks", "item_id")]
    warehouse_stocks = [_row_to_camel(r) for r in _fetch_all(cur, "warehouse_stocks", "item_id")]
    tech_docs = [_row_to_camel(r) for r in _fetch_all(cur, "tech_docs", "created_at")]

    wo_rows = _fetch_all(cur, "work_orders", "created_at")
    oi_rows = _fetch_all(cur, "order_items", "id")
    oi_by_order = {}
    for oi in oi_rows:
        oi_by_order.setdefault(oi["order_id"], []).append(oi)
    work_orders = []
    for wo in wo_rows:
        wo_camel = _row_to_camel(wo)
        items_list = []
        for oi in oi_by_order.get(wo["id"], []):
            oi_camel = _row_to_camel(oi)
            oi_camel.pop("orderId", None)
            items_list.append(oi_camel)
        wo_camel["items"] = items_list
        work_orders.append(wo_camel)

    rc_rows = _fetch_all(cur, "receipts", "date")
    rl_rows = _fetch_all(cur, "receipt_lines", "id")
    rl_by_receipt = {}
    for rl in rl_rows:
        rl_by_receipt.setdefault(rl["receipt_id"], []).append(rl)
    receipts = []
    for rc in rc_rows:
        rc_camel = _row_to_camel(rc)
        lines_list = []
        for rl in rl_by_receipt.get(rc["id"], []):
            rl_camel = _row_to_camel(rl)
            rl_camel.pop("receiptId", None)
            lines_list.append(rl_camel)
        rc_camel["lines"] = lines_list
        if rc_camel.get("customFields") is None:
            rc_camel["customFields"] = []
        if rc_camel.get("scanHistory") is None:
            rc_camel["scanHistory"] = []
        receipts.append(rc_camel)

    for td in tech_docs:
        if td.get("customFields") is None:
            td["customFields"] = []
        if td.get("attachments") is None:
            td["attachments"] = []

    for op in operations:
        if op.get("scannedCodes") is None:
            op["scannedCodes"] = []

    settings_rows = _fetch_all(cur, "app_settings", "key")
    settings_map = {r["key"]: r["value"] for r in settings_rows}

    state = {
        "items": items, "categories": categories, "locations": locations,
        "operations": operations, "warehouses": warehouses, "partners": partners,
        "barcodes": barcodes, "locationStocks": location_stocks,
        "warehouseStocks": warehouse_stocks, "workOrders": work_orders,
        "receipts": receipts, "techDocs": tech_docs,
    }
    for key, (field, converter) in SETTINGS_KEYS.items():
        state[field] = converter(settings_map.get(key))
    return state


# ── Save all (backward compat) ───────────────────────────────────────────────

def _save_all(cur, data):
    for tbl in TRUNCATE_ORDER:
        _truncate(cur, tbl)

    for w in data.get("warehouses", []):
        row = _prepare_row("warehouses", w)
        if row: _upsert(cur, "warehouses", row, TABLE_PKS["warehouses"])
    for c in data.get("categories", []):
        row = _prepare_row("categories", c)
        if row: _upsert(cur, "categories", row, TABLE_PKS["categories"])
    for loc in data.get("locations", []):
        row = _prepare_row("locations", loc)
        if row: _upsert(cur, "locations", row, TABLE_PKS["locations"])
    for p in data.get("partners", []):
        row = _prepare_row("partners", p)
        if row: _upsert(cur, "partners", row, TABLE_PKS["partners"])
    for item in data.get("items", []):
        row = _prepare_row("items", item)
        if row: _upsert(cur, "items", row, TABLE_PKS["items"])
    for op in data.get("operations", []):
        row = _prepare_row("operations", op)
        if row: _upsert(cur, "operations", row, TABLE_PKS["operations"])
    for ls in data.get("locationStocks", []):
        row = _prepare_row("location_stocks", ls)
        if row: _upsert(cur, "location_stocks", row, TABLE_PKS["location_stocks"])
    for ws in data.get("warehouseStocks", []):
        row = _prepare_row("warehouse_stocks", ws)
        if row: _upsert(cur, "warehouse_stocks", row, TABLE_PKS["warehouse_stocks"])
    for bc in data.get("barcodes", []):
        row = _prepare_row("barcodes", bc)
        if row: _upsert(cur, "barcodes", row, TABLE_PKS["barcodes"])

    for wo in data.get("workOrders", []):
        items_list = wo.pop("items", []) if "items" in wo else []
        row = _prepare_row("work_orders", wo)
        if row: _upsert(cur, "work_orders", row, TABLE_PKS["work_orders"])
        for oi in items_list:
            oi["orderId"] = wo.get("id", "")
            oi_row = _prepare_row("order_items", oi)
            if oi_row: _upsert(cur, "order_items", oi_row, TABLE_PKS["order_items"])

    for rc in data.get("receipts", []):
        lines = rc.pop("lines", []) if "lines" in rc else []
        row = _prepare_row("receipts", rc)
        if row: _upsert(cur, "receipts", row, TABLE_PKS["receipts"])
        for rl in lines:
            rl["receiptId"] = rc.get("id", "")
            rl_row = _prepare_row("receipt_lines", rl)
            if rl_row: _upsert(cur, "receipt_lines", rl_row, TABLE_PKS["receipt_lines"])

    for td in data.get("techDocs", []):
        row = _prepare_row("tech_docs", td)
        if row: _upsert(cur, "tech_docs", row, TABLE_PKS["tech_docs"])

    scalar_fields = {
        "darkMode": str(data.get("darkMode", False)).lower(),
        "defaultLowStockThreshold": str(data.get("defaultLowStockThreshold", 5)),
        "currentUser": data.get("currentUser", ""),
        "orderCounter": str(data.get("orderCounter", 0)),
        "receiptCounter": str(data.get("receiptCounter", 0)),
        "taskCounter": str(data.get("taskCounter", 0)),
    }
    for k, v in scalar_fields.items():
        _upsert(cur, "app_settings", {"key": k, "value": v}, TABLE_PKS["app_settings"])


# ── Individual actions ───────────────────────────────────────────────────────

def _action_upsert_item(cur, body):
    item = body.get("item", {})
    row = _prepare_row("items", item)
    if row: _upsert(cur, "items", row, TABLE_PKS["items"])
    for ls in body.get("locationStocks", []):
        ls_row = _prepare_row("location_stocks", ls)
        if ls_row: _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])
    for ws in body.get("warehouseStocks", []):
        ws_row = _prepare_row("warehouse_stocks", ws)
        if ws_row: _upsert(cur, "warehouse_stocks", ws_row, TABLE_PKS["warehouse_stocks"])

def _action_delete_item(cur, body):
    item_id = body.get("itemId")
    if not item_id: return
    _delete_multi(cur, "operations", "item_id", item_id)
    _delete_multi(cur, "location_stocks", "item_id", item_id)
    _delete_multi(cur, "warehouse_stocks", "item_id", item_id)
    _delete_multi(cur, "barcodes", "item_id", item_id)
    _delete_multi(cur, "tech_docs", "item_id", item_id)
    _delete_multi(cur, "order_items", "item_id", item_id)
    _delete_multi(cur, "receipt_lines", "item_id", item_id)
    _delete(cur, "items", "id", item_id)

def _action_upsert_operation(cur, body):
    op = body.get("operation", {})
    row = _prepare_row("operations", op)
    if row: _upsert(cur, "operations", row, TABLE_PKS["operations"])
    if "item" in body:
        item_row = _prepare_row("items", body["item"])
        if item_row: _upsert(cur, "items", item_row, TABLE_PKS["items"])
    for ls in body.get("locationStocks", []):
        ls_row = _prepare_row("location_stocks", ls)
        if ls_row: _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])
    for ws in body.get("warehouseStocks", []):
        ws_row = _prepare_row("warehouse_stocks", ws)
        if ws_row: _upsert(cur, "warehouse_stocks", ws_row, TABLE_PKS["warehouse_stocks"])

def _action_upsert_category(cur, body):
    cat = body.get("category", {})
    row = _prepare_row("categories", cat)
    if row: _upsert(cur, "categories", row, TABLE_PKS["categories"])

def _action_delete_category(cur, body):
    cat_id = body.get("categoryId")
    if not cat_id: return
    fallback = body.get("fallbackCategoryId")
    if fallback:
        cur.execute(f"UPDATE {_table('items')} SET category_id = %s WHERE category_id = %s", (fallback, cat_id))
    _delete(cur, "categories", "id", cat_id)

def _action_upsert_location(cur, body):
    loc = body.get("location", {})
    row = _prepare_row("locations", loc)
    if row: _upsert(cur, "locations", row, TABLE_PKS["locations"])

def _action_delete_location(cur, body):
    loc_id = body.get("locationId")
    if not loc_id: return
    _delete_multi(cur, "location_stocks", "location_id", loc_id)
    cur.execute(f"UPDATE {_table('locations')} SET parent_id = NULL WHERE parent_id = %s", (loc_id,))
    _delete(cur, "locations", "id", loc_id)

def _action_upsert_warehouse(cur, body):
    wh = body.get("warehouse", {})
    row = _prepare_row("warehouses", wh)
    if row: _upsert(cur, "warehouses", row, TABLE_PKS["warehouses"])

def _action_delete_warehouse(cur, body):
    wh_id = body.get("warehouseId")
    if not wh_id: return
    _delete_multi(cur, "warehouse_stocks", "warehouse_id", wh_id)
    cur.execute(f"UPDATE {_table('locations')} SET warehouse_id = NULL WHERE warehouse_id = %s", (wh_id,))
    _delete(cur, "warehouses", "id", wh_id)

def _action_upsert_partner(cur, body):
    p = body.get("partner", {})
    row = _prepare_row("partners", p)
    if row: _upsert(cur, "partners", row, TABLE_PKS["partners"])

def _action_delete_partner(cur, body):
    pid = body.get("partnerId")
    if pid: _delete(cur, "partners", "id", pid)

def _action_upsert_barcode(cur, body):
    bc = body.get("barcode", {})
    row = _prepare_row("barcodes", bc)
    if row: _upsert(cur, "barcodes", row, TABLE_PKS["barcodes"])

def _action_delete_barcode(cur, body):
    bid = body.get("barcodeId")
    if bid: _delete(cur, "barcodes", "id", bid)

def _action_upsert_work_order(cur, body):
    wo = body.get("workOrder", {})
    order_items = body.get("orderItems", [])
    row = _prepare_row("work_orders", wo)
    if row: _upsert(cur, "work_orders", row, TABLE_PKS["work_orders"])
    wo_id = wo.get("id", "")
    if wo_id:
        _delete_multi(cur, "order_items", "order_id", wo_id)
        for oi in order_items:
            oi["orderId"] = wo_id
            oi_row = _prepare_row("order_items", oi)
            if oi_row: _upsert(cur, "order_items", oi_row, TABLE_PKS["order_items"])

def _action_delete_work_order(cur, body):
    wo_id = body.get("workOrderId")
    if not wo_id: return
    _delete_multi(cur, "order_items", "order_id", wo_id)
    _delete(cur, "work_orders", "id", wo_id)

def _action_upsert_receipt(cur, body):
    rc = body.get("receipt", {})
    lines = body.get("receiptLines", [])
    row = _prepare_row("receipts", rc)
    if row: _upsert(cur, "receipts", row, TABLE_PKS["receipts"])
    rc_id = rc.get("id", "")
    if rc_id:
        _delete_multi(cur, "receipt_lines", "receipt_id", rc_id)
        for rl in lines:
            rl["receiptId"] = rc_id
            rl_row = _prepare_row("receipt_lines", rl)
            if rl_row: _upsert(cur, "receipt_lines", rl_row, TABLE_PKS["receipt_lines"])

def _action_delete_receipt(cur, body):
    rc_id = body.get("receiptId")
    if not rc_id: return
    _delete_multi(cur, "receipt_lines", "receipt_id", rc_id)
    _delete(cur, "receipts", "id", rc_id)

def _action_upsert_tech_doc(cur, body):
    td = body.get("techDoc", {})
    row = _prepare_row("tech_docs", td)
    if row: _upsert(cur, "tech_docs", row, TABLE_PKS["tech_docs"])

def _action_delete_tech_doc(cur, body):
    td_id = body.get("techDocId")
    if td_id: _delete(cur, "tech_docs", "id", td_id)

def _action_upsert_location_stock(cur, body):
    ls = body.get("locationStock", {})
    ls_row = _prepare_row("location_stocks", ls)
    if ls_row: _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])

def _action_update_setting(cur, body):
    key = body.get("key")
    value = body.get("value")
    if key:
        _upsert(cur, "app_settings", {"key": key, "value": str(value)}, TABLE_PKS["app_settings"])

def _action_update_settings(cur, body):
    settings = body.get("settings", {})
    for k, v in settings.items():
        _upsert(cur, "app_settings", {"key": k, "value": str(v)}, TABLE_PKS["app_settings"])


ACTION_MAP = {
    "upsert_item": _action_upsert_item,
    "delete_item": _action_delete_item,
    "upsert_operation": _action_upsert_operation,
    "upsert_category": _action_upsert_category,
    "delete_category": _action_delete_category,
    "upsert_location": _action_upsert_location,
    "delete_location": _action_delete_location,
    "upsert_warehouse": _action_upsert_warehouse,
    "delete_warehouse": _action_delete_warehouse,
    "upsert_partner": _action_upsert_partner,
    "delete_partner": _action_delete_partner,
    "upsert_barcode": _action_upsert_barcode,
    "delete_barcode": _action_delete_barcode,
    "upsert_work_order": _action_upsert_work_order,
    "delete_work_order": _action_delete_work_order,
    "upsert_receipt": _action_upsert_receipt,
    "delete_receipt": _action_delete_receipt,
    "upsert_tech_doc": _action_upsert_tech_doc,
    "delete_tech_doc": _action_delete_tech_doc,
    "upsert_location_stock": _action_upsert_location_stock,
    "update_setting": _action_update_setting,
    "update_settings": _action_update_settings,
}


# ── Flask routes ─────────────────────────────────────────────────────────────

def ensure_tables():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    for tbl, cols_def in [
        ("warehouses", "id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
        ("categories", "id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT, color TEXT NOT NULL DEFAULT '#6366f1'"),
        ("locations", "id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT, description TEXT, warehouse_id TEXT"),
        ("items", "id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT, location_id TEXT, description TEXT, unit TEXT NOT NULL DEFAULT 'шт', quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 5, image_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), attachments JSONB DEFAULT '[]'"),
        ("operations", "id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL, quantity INTEGER NOT NULL, comment TEXT, from_place TEXT, to_place TEXT, performed_by TEXT NOT NULL, date TIMESTAMPTZ NOT NULL DEFAULT NOW(), order_id TEXT, location_id TEXT, warehouse_id TEXT, scanned_codes JSONB DEFAULT '[]'"),
        ("location_stocks", "item_id TEXT NOT NULL, location_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (item_id, location_id)"),
        ("warehouse_stocks", "item_id TEXT NOT NULL, warehouse_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (item_id, warehouse_id)"),
        ("partners", "id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, contact TEXT, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
        ("barcodes", "id TEXT PRIMARY KEY, item_id TEXT NOT NULL, code TEXT NOT NULL, format TEXT, label TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
        ("work_orders", "id TEXT PRIMARY KEY, number TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL, recipient_id TEXT, recipient_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), comment TEXT"),
        ("order_items", "id TEXT PRIMARY KEY, order_id TEXT NOT NULL, item_id TEXT NOT NULL, required_qty INTEGER NOT NULL DEFAULT 0, picked_qty INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending'"),
        ("receipts", "id TEXT PRIMARY KEY, number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', supplier_id TEXT, supplier_name TEXT NOT NULL, warehouse_id TEXT, date TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by TEXT NOT NULL, comment TEXT, total_amount NUMERIC, posted_at TIMESTAMPTZ, custom_fields JSONB DEFAULT '[]', scan_history JSONB DEFAULT '[]', photo_url TEXT"),
        ("receipt_lines", "id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL, item_id TEXT NOT NULL, item_name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0, confirmed_qty INTEGER NOT NULL DEFAULT 0, location_id TEXT, price NUMERIC, unit TEXT NOT NULL DEFAULT 'шт', is_new BOOLEAN DEFAULT FALSE"),
        ("tech_docs", "id TEXT PRIMARY KEY, item_id TEXT NOT NULL, doc_number TEXT, doc_date TEXT, doc_type TEXT NOT NULL, supplier TEXT, notes TEXT, custom_fields JSONB DEFAULT '[]', attachments JSONB DEFAULT '[]', cover_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by TEXT NOT NULL"),
        ("users", "id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
        ("sessions", "id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip_address TEXT"),
    ]:
        cur.execute(f"CREATE TABLE IF NOT EXISTS {SCHEMA}.{tbl} ({cols_def})")

    cur.execute(f"ALTER TABLE {SCHEMA}.receipts ADD COLUMN IF NOT EXISTS photo_url TEXT")
    cur.execute(f"ALTER TABLE {SCHEMA}.tech_docs ADD COLUMN IF NOT EXISTS cover_url TEXT")
    cur.execute(f"ALTER TABLE {SCHEMA}.items ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'")

    cur.execute(f"""
        INSERT INTO {SCHEMA}.app_settings (key, value) VALUES
            ('darkMode', 'false'), ('defaultLowStockThreshold', '5'),
            ('currentUser', 'Администратор'), ('orderCounter', '3'),
            ('receiptCounter', '1'), ('taskCounter', '1')
        ON CONFLICT (key) DO NOTHING
    """)
    admin_hash = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.users (id, username, password_hash, display_name, role)
        VALUES ('user-admin-1', 'admin', %s, 'Администратор', 'admin')
        ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
    """, (admin_hash,))
    cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE username = 'admin'", (admin_hash,))
    print(f"[INIT] Admin user ensured with password_hash, schema={SCHEMA}")
    conn.commit()
    cur.close()
    conn.close()


@app.route("/api/crud", methods=["GET", "POST", "OPTIONS"])
def crud_handler():
    if request.method == "OPTIONS":
        return "", 200

    conn = get_conn()
    cur = conn.cursor()

    try:
        if request.method == "GET":
            action = request.args.get("action", "load_all")
            if action == "check":
                cur.execute("SELECT NOW()")
                ts = cur.fetchone()[0]
                conn.close()
                return jsonify({"updatedAt": ts.isoformat()})
            state = _load_all(cur)
            cur.execute("SELECT NOW()")
            ts = cur.fetchone()[0]
            conn.close()
            return app.response_class(
                response=_json_dumps({"data": state, "updatedAt": ts.isoformat()}),
                mimetype="application/json"
            )

        if request.method == "POST":
            body = request.get_json(force=True)
            action = body.get("action", "save_all")

            if action == "save_all":
                data = body.get("data")
                if data is None:
                    conn.close()
                    return jsonify({"error": "missing data"}), 400
                _save_all(cur, data)
                conn.commit()
                cur.execute("SELECT NOW()")
                ts = cur.fetchone()[0]
                conn.close()
                return jsonify({"ok": True, "updatedAt": ts.isoformat()})

            handler_fn = ACTION_MAP.get(action)
            if not handler_fn:
                conn.close()
                return jsonify({"error": f"unknown action: {action}"}), 400

            handler_fn(cur, body)
            conn.commit()
            conn.close()
            return jsonify({"ok": True})

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()
    return jsonify({"error": "method not allowed"}), 405


# ── Auth routes ──────────────────────────────────────────────────────────────

def _hash_pw(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def _verify_pw(password, hashed):
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return password == hashed

def _get_auth_token():
    return request.headers.get('X-Auth-Token') or request.headers.get('x-auth-token') or ''

def _authenticate(cur):
    token = _get_auth_token()
    if not token:
        return None
    cur.execute(f"SELECT s.user_id, s.expires_at, u.id, u.username, u.display_name, u.role, u.is_active FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON s.user_id = u.id WHERE s.token = %s", (token,))
    row = cur.fetchone()
    if not row:
        return None
    _, expires_at, uid, uname, dname, role, active = row
    if not active or (expires_at and expires_at < datetime.now(timezone.utc)):
        return None
    return {"id": uid, "username": uname, "displayName": dname, "role": role}


@app.route("/api/auth", methods=["GET", "POST", "OPTIONS"])
def auth_handler():
    if request.method == "OPTIONS":
        return "", 200

    conn = get_conn()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            action = request.args.get("action", "me")
            if action == "me":
                user = _authenticate(cur)
                conn.close()
                if not user:
                    return jsonify({"error": "unauthorized"}), 401
                return jsonify({"user": user})

            if action == "list_users":
                user = _authenticate(cur)
                if not user or user["role"] != "admin":
                    conn.close()
                    return jsonify({"error": "forbidden"}), 403
                cur.execute(f"SELECT id, username, display_name, role, is_active, created_at FROM {SCHEMA}.users ORDER BY created_at")
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                conn.close()
                users = [{"id": r["id"], "username": r["username"], "displayName": r["display_name"], "role": r["role"], "isActive": r["is_active"], "createdAt": r["created_at"].isoformat() if r["created_at"] else None} for r in rows]
                return jsonify({"users": users})

        if request.method == "POST":
            body = request.get_json(force=True)
            action = body.get("action", "")

            if action == "login":
                username = body.get("username", "")
                password = body.get("password", "")
                cur.execute(f"SELECT id, username, password_hash, display_name, role, is_active FROM {SCHEMA}.users WHERE username = %s", (username,))
                row = cur.fetchone()
                if not row:
                    conn.close()
                    return jsonify({"error": "Неверный логин или пароль"}), 401
                uid, uname, pw_hash, dname, role, active = row
                if not active:
                    conn.close()
                    return jsonify({"error": "Аккаунт заблокирован"}), 401
                if not _verify_pw(password, pw_hash):
                    conn.close()
                    return jsonify({"error": "Неверный логин или пароль"}), 401
                token = str(uuid.uuid4())
                expires = datetime.now(timezone.utc) + timedelta(days=30)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id, token, expires_at, ip_address) VALUES (%s, %s, %s, %s, %s)",
                    (str(uuid.uuid4()), uid, token, expires, request.remote_addr or ''))
                cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE expires_at < NOW()")
                conn.commit()
                conn.close()
                return jsonify({"ok": True, "token": token, "user": {"id": uid, "username": uname, "displayName": dname, "role": role}})

            if action == "logout":
                tok = _get_auth_token()
                if tok:
                    cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE token = %s", (tok,))
                    conn.commit()
                conn.close()
                return jsonify({"ok": True})

            if action == "register":
                user = _authenticate(cur)
                if not user or user["role"] != "admin":
                    conn.close()
                    return jsonify({"error": "forbidden"}), 403
                uname = body.get("username", "").strip()
                pw = body.get("password", "")
                dname = body.get("displayName", uname)
                role = body.get("role", "viewer")
                if not uname or not pw:
                    conn.close()
                    return jsonify({"error": "Заполните логин и пароль"}), 400
                pw_hash = _hash_pw(pw)
                uid = str(uuid.uuid4())
                try:
                    cur.execute(f"INSERT INTO {SCHEMA}.users (id, username, password_hash, display_name, role) VALUES (%s, %s, %s, %s, %s)",
                        (uid, uname, pw_hash, dname, role))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    conn.close()
                    return jsonify({"error": "Логин уже занят"}), 400
                conn.close()
                return jsonify({"ok": True, "user": {"id": uid, "username": uname, "displayName": dname, "role": role}})

            if action == "change_password":
                user = _authenticate(cur)
                if not user:
                    conn.close()
                    return jsonify({"error": "unauthorized"}), 401
                target_id = body.get("userId", "")
                new_pw = body.get("newPassword", "")
                if user["role"] != "admin" and target_id != user["id"]:
                    conn.close()
                    return jsonify({"error": "forbidden"}), 403
                pw_hash = _hash_pw(new_pw)
                cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s, updated_at = NOW() WHERE id = %s", (pw_hash, target_id))
                conn.commit()
                conn.close()
                return jsonify({"ok": True})

            if action == "update_user":
                user = _authenticate(cur)
                if not user or user["role"] != "admin":
                    conn.close()
                    return jsonify({"error": "forbidden"}), 403
                target_id = body.get("userId", "")
                sets = []
                vals = []
                if "displayName" in body:
                    sets.append("display_name = %s"); vals.append(body["displayName"])
                if "role" in body:
                    sets.append("role = %s"); vals.append(body["role"])
                if "isActive" in body:
                    sets.append("is_active = %s"); vals.append(body["isActive"])
                if sets:
                    sets.append("updated_at = NOW()")
                    vals.append(target_id)
                    cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id = %s", vals)
                    conn.commit()
                conn.close()
                return jsonify({"ok": True})

            if action == "delete_user":
                user = _authenticate(cur)
                if not user or user["role"] != "admin":
                    conn.close()
                    return jsonify({"error": "forbidden"}), 403
                target_id = body.get("userId", "")
                if target_id == user["id"]:
                    conn.close()
                    return jsonify({"error": "Нельзя удалить себя"}), 400
                cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE user_id = %s", (target_id,))
                cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id = %s", (target_id,))
                conn.commit()
                conn.close()
                return jsonify({"ok": True})

        conn.close()
        return jsonify({"error": "unknown action"}), 400
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


# ── Telegram notify ───────────────────────────────────────────────────────────

def _send_telegram(chat_id, text):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception:
        return False


@app.route("/api/telegram-notify", methods=["POST", "OPTIONS"])
def telegram_handler():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True)
    action = body.get("action", "")
    chat_id = body.get("chatId", "")
    if not chat_id:
        return jsonify({"error": "chatId обязателен"}), 400
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return jsonify({"error": "TELEGRAM_BOT_TOKEN не настроен"}), 500
    if action == "test":
        ok = _send_telegram(chat_id, "✅ <b>StockBase подключен!</b>\nУведомления работают.")
        return jsonify({"ok": True}) if ok else (jsonify({"error": "Не удалось отправить"}), 400)
    if action == "send_low_stock":
        items = body.get("items", [])
        if not items:
            return jsonify({"ok": True, "skipped": True})
        lines = ["⚠️ <b>Низкий остаток!</b>\n"]
        for it in items:
            lines.append(f"• <b>{it['name']}</b> — {it['quantity']} {it.get('unit', 'шт')} (порог: {it['threshold']})")
        lines.append(f"\nТоваров с низким остатком: {len(items)}")
        ok = _send_telegram(chat_id, "\n".join(lines))
        return jsonify({"ok": True}) if ok else (jsonify({"error": "Ошибка отправки"}), 500)
    if action == "send_operation":
        item_name = body.get("itemName", "?")
        op_type = body.get("type", "in")
        qty = body.get("quantity", 0)
        who = body.get("performedBy", "?")
        emoji = "📥" if op_type == "in" else "📤"
        label = "Приход" if op_type == "in" else "Расход"
        ok = _send_telegram(chat_id, f"{emoji} <b>{label}</b>\n{item_name} × {qty}\nИсполнитель: {who}")
        return jsonify({"ok": True}) if ok else (jsonify({"error": "Ошибка отправки"}), 500)
    if action == "send_message":
        text = body.get("text", "")
        if not text:
            return jsonify({"error": "text обязателен"}), 400
        ok = _send_telegram(chat_id, text)
        return jsonify({"ok": True}) if ok else (jsonify({"error": "Ошибка отправки"}), 500)
    return jsonify({"error": f"unknown action: {action}"}), 400


@app.route("/health", methods=["GET"])
def health():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "detail": str(e)}), 500


if __name__ == "__main__":
    ensure_tables()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)