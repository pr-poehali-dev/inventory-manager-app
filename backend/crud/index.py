"""
CRUD API для приложения управления складом (v2).

Предоставляет гранулярные операции создания, чтения, обновления и удаления
для всех сущностей складского учёта. Заменяет монолитный подход «сохранить всё состояние»
набором точечных действий, сохраняя обратную совместимость через action=save_all.
"""

import json
import os
import re
import urllib.parse
from datetime import datetime, date, timezone

import psycopg2
import psycopg2.extras

# ── Constants ──────────────────────────────────────────────────────────────────

SCHEMA = "t_p45174738_inventory_manager_ap"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

JSON_HEADERS = {**CORS, "Content-Type": "application/json"}

# ── camelCase <-> snake_case mapping ──────────────────────────────────────────

# Special mappings where the simple conversion rule doesn't apply
CAMEL_TO_SNAKE_SPECIAL = {
    "from": "from_place",
    "to": "to_place",
}

SNAKE_TO_CAMEL_SPECIAL = {
    "from_place": "from",
    "to_place": "to",
}


def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    if name in CAMEL_TO_SNAKE_SPECIAL:
        return CAMEL_TO_SNAKE_SPECIAL[name]
    result = re.sub(r"([A-Z])", r"_\1", name).lower()
    return result


def _snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    if name in SNAKE_TO_CAMEL_SPECIAL:
        return SNAKE_TO_CAMEL_SPECIAL[name]
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def _row_to_camel(row: dict) -> dict:
    """Convert all keys in a dict from snake_case to camelCase."""
    return {_snake_to_camel(k): v for k, v in row.items()}


def _body_to_snake(data: dict) -> dict:
    """Convert all keys in a dict from camelCase to snake_case."""
    return {_camel_to_snake(k): v for k, v in data.items()}


# ── JSON serialization helper ─────────────────────────────────────────────────

def _json_serial(obj):
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def _json_dumps(data) -> str:
    return json.dumps(data, default=_json_serial, ensure_ascii=False)


# ── Database connection ───────────────────────────────────────────────────────

def get_conn():
    """Создать подключение к БД из DATABASE_URL."""
    url = urllib.parse.urlparse(os.environ["DATABASE_URL"])
    conn = psycopg2.connect(
        user=urllib.parse.unquote(url.username or ""),
        password=urllib.parse.unquote(url.password or ""),
        host=url.hostname,
        port=url.port or 5432,
        database=url.path.lstrip("/"),
        sslmode="disable",
    )
    conn.autocommit = False
    return conn


# ── Response helpers ──────────────────────────────────────────────────────────

def ok(data=None):
    body = data if data is not None else {"ok": True}
    return {
        "statusCode": 200,
        "headers": JSON_HEADERS,
        "body": _json_dumps(body),
    }


def error(status: int, msg: str):
    return {
        "statusCode": status,
        "headers": JSON_HEADERS,
        "body": _json_dumps({"error": msg}),
    }


# ── Generic DB helpers ────────────────────────────────────────────────────────

def _table(name: str) -> str:
    return f"{SCHEMA}.{name}"


def _fetch_all(cur, table: str, order_by: str = "id") -> list[dict]:
    """Fetch all rows from a table as list of dicts with snake_case keys."""
    cur.execute(f"SELECT * FROM {_table(table)} ORDER BY {order_by}")
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _fetch_by(cur, table: str, where_col: str, where_val) -> list[dict]:
    cur.execute(f"SELECT * FROM {_table(table)} WHERE {where_col} = %s", (where_val,))
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _upsert(cur, table: str, data: dict, pk_cols: list[str]):
    """Generic UPSERT (INSERT ... ON CONFLICT DO UPDATE)."""
    if not data:
        return
    cols = list(data.keys())
    vals = [json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in data.values()]
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    conflict_cols = ", ".join(pk_cols)
    update_set = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in cols if c not in pk_cols
    )
    if update_set:
        sql = (
            f"INSERT INTO {_table(table)} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_set}"
        )
    else:
        sql = (
            f"INSERT INTO {_table(table)} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict_cols}) DO NOTHING"
        )
    cur.execute(sql, vals)


def _delete(cur, table: str, pk_col: str, pk_val):
    cur.execute(f"DELETE FROM {_table(table)} WHERE {pk_col} = %s", (pk_val,))


def _delete_multi(cur, table: str, where_col: str, where_val):
    cur.execute(f"DELETE FROM {_table(table)} WHERE {where_col} = %s", (where_val,))


def _truncate(cur, table: str):
    cur.execute(f"DELETE FROM {_table(table)}")


# ── Column definitions for each table (DB column names) ──────────────────────
# Used to filter incoming data to only valid columns

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

# Primary key columns per table
TABLE_PKS = {
    "warehouses": ["id"],
    "categories": ["id"],
    "locations": ["id"],
    "items": ["id"],
    "operations": ["id"],
    "location_stocks": ["item_id", "location_id"],
    "warehouse_stocks": ["item_id", "warehouse_id"],
    "partners": ["id"],
    "barcodes": ["id"],
    "work_orders": ["id"],
    "order_items": ["id"],
    "receipts": ["id"],
    "receipt_lines": ["id"],
    "tech_docs": ["id"],
    "app_settings": ["key"],
}

# JSONB columns that need json.dumps before insert
JSONB_COLUMNS = {"scanned_codes", "custom_fields", "scan_history", "attachments"}


def _prepare_row(table: str, camel_data: dict) -> dict:
    """Convert camelCase input to snake_case and filter to valid columns."""
    snake = _body_to_snake(camel_data)
    valid_cols = set(TABLE_COLUMNS.get(table, []))
    result = {}
    for k, v in snake.items():
        if k in valid_cols:
            result[k] = v
    return result


# ── LOAD ALL ──────────────────────────────────────────────────────────────────

# Settings keys that map to AppState scalar fields
SETTINGS_KEYS = {
    "darkMode": ("darkMode", lambda v: v.lower() == "true" if v else False),
    "defaultLowStockThreshold": ("defaultLowStockThreshold", lambda v: int(v) if v else 5),
    "currentUser": ("currentUser", lambda v: v if v else ""),
    "orderCounter": ("orderCounter", lambda v: int(v) if v else 0),
    "receiptCounter": ("receiptCounter", lambda v: int(v) if v else 0),
    "taskCounter": ("taskCounter", lambda v: int(v) if v else 0),
}


def _load_all(cur) -> dict:
    """Загрузить все данные из таблиц и вернуть в формате AppState (camelCase)."""

    # Simple tables
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

    # Work orders with nested items
    wo_rows = _fetch_all(cur, "work_orders", "created_at")
    oi_rows = _fetch_all(cur, "order_items", "id")
    # Group order items by order_id
    oi_by_order = {}
    for oi in oi_rows:
        oid = oi["order_id"]
        oi_by_order.setdefault(oid, []).append(oi)
    work_orders = []
    for wo in wo_rows:
        wo_camel = _row_to_camel(wo)
        order_items_raw = oi_by_order.get(wo["id"], [])
        # Convert order items: remove order_id, use camelCase
        items_list = []
        for oi in order_items_raw:
            oi_camel = _row_to_camel(oi)
            oi_camel.pop("orderId", None)
            items_list.append(oi_camel)
        wo_camel["items"] = items_list
        work_orders.append(wo_camel)

    # Receipts with nested lines
    rc_rows = _fetch_all(cur, "receipts", "date")
    rl_rows = _fetch_all(cur, "receipt_lines", "id")
    # Group receipt lines by receipt_id
    rl_by_receipt = {}
    for rl in rl_rows:
        rid = rl["receipt_id"]
        rl_by_receipt.setdefault(rid, []).append(rl)
    receipts = []
    for rc in rc_rows:
        rc_camel = _row_to_camel(rc)
        lines_raw = rl_by_receipt.get(rc["id"], [])
        lines_list = []
        for rl in lines_raw:
            rl_camel = _row_to_camel(rl)
            rl_camel.pop("receiptId", None)
            lines_list.append(rl_camel)
        rc_camel["lines"] = lines_list
        # Ensure customFields and scanHistory are lists
        if rc_camel.get("customFields") is None:
            rc_camel["customFields"] = []
        if rc_camel.get("scanHistory") is None:
            rc_camel["scanHistory"] = []
        receipts.append(rc_camel)

    # Tech docs: ensure customFields and attachments are lists
    for td in tech_docs:
        if td.get("customFields") is None:
            td["customFields"] = []
        if td.get("attachments") is None:
            td["attachments"] = []

    # Operations: ensure scannedCodes is a list
    for op in operations:
        if op.get("scannedCodes") is None:
            op["scannedCodes"] = []

    # Settings
    settings_rows = _fetch_all(cur, "app_settings", "key")
    settings_map = {r["key"]: r["value"] for r in settings_rows}

    state = {
        "items": items,
        "categories": categories,
        "locations": locations,
        "operations": operations,
        "warehouses": warehouses,
        "partners": partners,
        "barcodes": barcodes,
        "locationStocks": location_stocks,
        "warehouseStocks": warehouse_stocks,
        "workOrders": work_orders,
        "receipts": receipts,
        "techDocs": tech_docs,
    }

    # Add scalar settings
    for key, (field, converter) in SETTINGS_KEYS.items():
        state[field] = converter(settings_map.get(key))

    return state


# ── SAVE ALL (backward compat) ────────────────────────────────────────────────

# Tables to truncate in order (respecting dependencies)
TRUNCATE_ORDER = [
    "order_items", "receipt_lines", "operations", "barcodes",
    "location_stocks", "warehouse_stocks",
    "work_orders", "receipts", "tech_docs",
    "items", "locations", "categories", "warehouses", "partners",
    "app_settings",
]


def _save_all(cur, data: dict):
    """Полная перезапись всех таблиц из AppState (обратная совместимость)."""

    # Truncate all tables
    for tbl in TRUNCATE_ORDER:
        _truncate(cur, tbl)

    # Insert warehouses
    for w in data.get("warehouses", []):
        row = _prepare_row("warehouses", w)
        if row:
            _upsert(cur, "warehouses", row, TABLE_PKS["warehouses"])

    # Insert categories
    for c in data.get("categories", []):
        row = _prepare_row("categories", c)
        if row:
            _upsert(cur, "categories", row, TABLE_PKS["categories"])

    # Insert locations
    for loc in data.get("locations", []):
        row = _prepare_row("locations", loc)
        if row:
            _upsert(cur, "locations", row, TABLE_PKS["locations"])

    # Insert partners
    for p in data.get("partners", []):
        row = _prepare_row("partners", p)
        if row:
            _upsert(cur, "partners", row, TABLE_PKS["partners"])

    # Insert items
    for item in data.get("items", []):
        row = _prepare_row("items", item)
        if row:
            _upsert(cur, "items", row, TABLE_PKS["items"])

    # Insert operations
    for op in data.get("operations", []):
        row = _prepare_row("operations", op)
        if row:
            _upsert(cur, "operations", row, TABLE_PKS["operations"])

    # Insert location stocks
    for ls in data.get("locationStocks", []):
        row = _prepare_row("location_stocks", ls)
        if row:
            _upsert(cur, "location_stocks", row, TABLE_PKS["location_stocks"])

    # Insert warehouse stocks
    for ws in data.get("warehouseStocks", []):
        row = _prepare_row("warehouse_stocks", ws)
        if row:
            _upsert(cur, "warehouse_stocks", row, TABLE_PKS["warehouse_stocks"])

    # Insert barcodes
    for bc in data.get("barcodes", []):
        row = _prepare_row("barcodes", bc)
        if row:
            _upsert(cur, "barcodes", row, TABLE_PKS["barcodes"])

    # Insert work orders + order items
    for wo in data.get("workOrders", []):
        items_list = wo.pop("items", []) if "items" in wo else []
        row = _prepare_row("work_orders", wo)
        if row:
            _upsert(cur, "work_orders", row, TABLE_PKS["work_orders"])
        for oi in items_list:
            oi["orderId"] = wo.get("id", "")
            oi_row = _prepare_row("order_items", oi)
            if oi_row:
                _upsert(cur, "order_items", oi_row, TABLE_PKS["order_items"])

    # Insert receipts + receipt lines
    for rc in data.get("receipts", []):
        lines = rc.pop("lines", []) if "lines" in rc else []
        row = _prepare_row("receipts", rc)
        if row:
            _upsert(cur, "receipts", row, TABLE_PKS["receipts"])
        for rl in lines:
            rl["receiptId"] = rc.get("id", "")
            rl_row = _prepare_row("receipt_lines", rl)
            if rl_row:
                _upsert(cur, "receipt_lines", rl_row, TABLE_PKS["receipt_lines"])

    # Insert tech docs
    for td in data.get("techDocs", []):
        row = _prepare_row("tech_docs", td)
        if row:
            _upsert(cur, "tech_docs", row, TABLE_PKS["tech_docs"])

    # Insert settings
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

    # Also write to legacy app_state table for backward compat
    json_str = json.dumps(data, default=_json_serial, ensure_ascii=False)
    cur.execute(
        f"INSERT INTO {_table('app_state')} (id, data, updated_at) VALUES (1, %s::jsonb, NOW()) "
        f"ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
        (json_str,),
    )


# ── Individual CRUD actions ───────────────────────────────────────────────────

def _action_upsert_item(cur, body: dict):
    item = body.get("item", {})
    row = _prepare_row("items", item)
    if row:
        _upsert(cur, "items", row, TABLE_PKS["items"])
    # Upsert related stocks if provided
    for ls in body.get("locationStocks", []):
        ls_row = _prepare_row("location_stocks", ls)
        if ls_row:
            _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])
    for ws in body.get("warehouseStocks", []):
        ws_row = _prepare_row("warehouse_stocks", ws)
        if ws_row:
            _upsert(cur, "warehouse_stocks", ws_row, TABLE_PKS["warehouse_stocks"])


def _action_delete_item(cur, body: dict):
    item_id = body.get("itemId")
    if not item_id:
        return
    # Delete related records first
    _delete_multi(cur, "operations", "item_id", item_id)
    _delete_multi(cur, "location_stocks", "item_id", item_id)
    _delete_multi(cur, "warehouse_stocks", "item_id", item_id)
    _delete_multi(cur, "barcodes", "item_id", item_id)
    _delete_multi(cur, "tech_docs", "item_id", item_id)
    # Delete order items referencing this item
    _delete_multi(cur, "order_items", "item_id", item_id)
    # Delete receipt lines referencing this item
    _delete_multi(cur, "receipt_lines", "item_id", item_id)
    # Finally delete the item
    _delete(cur, "items", "id", item_id)


def _action_upsert_operation(cur, body: dict):
    op = body.get("operation", {})
    row = _prepare_row("operations", op)
    if row:
        _upsert(cur, "operations", row, TABLE_PKS["operations"])
    # Update item quantity if itemId and quantity delta info are given
    # The frontend is expected to send the updated item quantity separately
    # or include full item object
    if "item" in body:
        item_row = _prepare_row("items", body["item"])
        if item_row:
            _upsert(cur, "items", item_row, TABLE_PKS["items"])
    # Update stocks
    for ls in body.get("locationStocks", []):
        ls_row = _prepare_row("location_stocks", ls)
        if ls_row:
            _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])
    for ws in body.get("warehouseStocks", []):
        ws_row = _prepare_row("warehouse_stocks", ws)
        if ws_row:
            _upsert(cur, "warehouse_stocks", ws_row, TABLE_PKS["warehouse_stocks"])


def _action_upsert_category(cur, body: dict):
    cat = body.get("category", {})
    row = _prepare_row("categories", cat)
    if row:
        _upsert(cur, "categories", row, TABLE_PKS["categories"])


def _action_delete_category(cur, body: dict):
    cat_id = body.get("categoryId")
    if not cat_id:
        return
    fallback = body.get("fallbackCategoryId")
    if fallback:
        cur.execute(
            f"UPDATE {_table('items')} SET category_id = %s WHERE category_id = %s",
            (fallback, cat_id),
        )
    _delete(cur, "categories", "id", cat_id)


def _action_upsert_location(cur, body: dict):
    loc = body.get("location", {})
    row = _prepare_row("locations", loc)
    if row:
        _upsert(cur, "locations", row, TABLE_PKS["locations"])


def _action_delete_location(cur, body: dict):
    loc_id = body.get("locationId")
    if not loc_id:
        return
    # Delete location stocks
    _delete_multi(cur, "location_stocks", "location_id", loc_id)
    # Update child locations
    cur.execute(
        f"UPDATE {_table('locations')} SET parent_id = NULL WHERE parent_id = %s",
        (loc_id,),
    )
    _delete(cur, "locations", "id", loc_id)


def _action_upsert_warehouse(cur, body: dict):
    wh = body.get("warehouse", {})
    row = _prepare_row("warehouses", wh)
    if row:
        _upsert(cur, "warehouses", row, TABLE_PKS["warehouses"])


def _action_delete_warehouse(cur, body: dict):
    wh_id = body.get("warehouseId")
    if not wh_id:
        return
    _delete_multi(cur, "warehouse_stocks", "warehouse_id", wh_id)
    # Unlink locations
    cur.execute(
        f"UPDATE {_table('locations')} SET warehouse_id = NULL WHERE warehouse_id = %s",
        (wh_id,),
    )
    _delete(cur, "warehouses", "id", wh_id)


def _action_upsert_partner(cur, body: dict):
    p = body.get("partner", {})
    row = _prepare_row("partners", p)
    if row:
        _upsert(cur, "partners", row, TABLE_PKS["partners"])


def _action_delete_partner(cur, body: dict):
    pid = body.get("partnerId")
    if not pid:
        return
    _delete(cur, "partners", "id", pid)


def _action_upsert_barcode(cur, body: dict):
    bc = body.get("barcode", {})
    row = _prepare_row("barcodes", bc)
    if row:
        _upsert(cur, "barcodes", row, TABLE_PKS["barcodes"])


def _action_delete_barcode(cur, body: dict):
    bid = body.get("barcodeId")
    if not bid:
        return
    _delete(cur, "barcodes", "id", bid)


def _action_upsert_work_order(cur, body: dict):
    wo = body.get("workOrder", {})
    order_items = body.get("orderItems", [])
    row = _prepare_row("work_orders", wo)
    if row:
        _upsert(cur, "work_orders", row, TABLE_PKS["work_orders"])
    wo_id = wo.get("id", "")
    if wo_id:
        # Remove old order items for this order, then reinsert
        _delete_multi(cur, "order_items", "order_id", wo_id)
        for oi in order_items:
            oi["orderId"] = wo_id
            oi_row = _prepare_row("order_items", oi)
            if oi_row:
                _upsert(cur, "order_items", oi_row, TABLE_PKS["order_items"])


def _action_delete_work_order(cur, body: dict):
    wo_id = body.get("workOrderId")
    if not wo_id:
        return
    _delete_multi(cur, "order_items", "order_id", wo_id)
    _delete(cur, "work_orders", "id", wo_id)


def _action_upsert_receipt(cur, body: dict):
    rc = body.get("receipt", {})
    lines = body.get("receiptLines", [])
    row = _prepare_row("receipts", rc)
    if row:
        _upsert(cur, "receipts", row, TABLE_PKS["receipts"])
    rc_id = rc.get("id", "")
    if rc_id:
        # Remove old lines then reinsert
        _delete_multi(cur, "receipt_lines", "receipt_id", rc_id)
        for rl in lines:
            rl["receiptId"] = rc_id
            rl_row = _prepare_row("receipt_lines", rl)
            if rl_row:
                _upsert(cur, "receipt_lines", rl_row, TABLE_PKS["receipt_lines"])


def _action_delete_receipt(cur, body: dict):
    rc_id = body.get("receiptId")
    if not rc_id:
        return
    _delete_multi(cur, "receipt_lines", "receipt_id", rc_id)
    _delete(cur, "receipts", "id", rc_id)


def _action_upsert_tech_doc(cur, body: dict):
    td = body.get("techDoc", {})
    row = _prepare_row("tech_docs", td)
    if row:
        _upsert(cur, "tech_docs", row, TABLE_PKS["tech_docs"])


def _action_delete_tech_doc(cur, body: dict):
    td_id = body.get("techDocId")
    if not td_id:
        return
    _delete(cur, "tech_docs", "id", td_id)


def _action_upsert_location_stock(cur, body: dict):
    ls = body.get("locationStock", {})
    ls_row = _prepare_row("location_stocks", ls)
    if ls_row:
        _upsert(cur, "location_stocks", ls_row, TABLE_PKS["location_stocks"])


def _action_update_setting(cur, body: dict):
    key = body.get("key")
    value = body.get("value")
    if key is not None:
        _upsert(cur, "app_settings", {"key": key, "value": str(value)}, TABLE_PKS["app_settings"])


def _action_update_settings(cur, body: dict):
    settings = body.get("settings", {})
    for k, v in settings.items():
        _upsert(cur, "app_settings", {"key": k, "value": str(v)}, TABLE_PKS["app_settings"])


# ── Action dispatch ───────────────────────────────────────────────────────────

POST_ACTIONS = {
    "save_all": lambda cur, body: _save_all(cur, body.get("data", {})),
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


# ── Main handler ──────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Обработчик CRUD-запросов складского приложения. Поддерживает гранулярные
    операции создания, чтения, обновления и удаления для всех сущностей."""

    # OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}

    # ── GET ────────────────────────────────────────────────────────────────
    if method == "GET":
        action = params.get("action", "load_all")

        if action == "check":
            conn = get_conn()
            try:
                cur = conn.cursor()
                cur.execute(f"SELECT NOW()")
                now_row = cur.fetchone()
                updated_at = now_row[0].isoformat() if now_row else None
                conn.commit()
                return ok({"updatedAt": updated_at})
            except Exception as e:
                conn.rollback()
                return error(500, str(e))
            finally:
                conn.close()

        if action == "load_all":
            conn = get_conn()
            try:
                cur = conn.cursor()
                state = _load_all(cur)
                cur.execute("SELECT NOW()")
                now_row = cur.fetchone()
                updated_at = now_row[0].isoformat() if now_row else None
                conn.commit()
                return ok({"data": state, "updatedAt": updated_at})
            except Exception as e:
                conn.rollback()
                return error(500, str(e))
            finally:
                conn.close()

        return error(400, f"Unknown GET action: {action}")

    # ── POST ───────────────────────────────────────────────────────────────
    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError as e:
            return error(400, f"Invalid JSON: {e}")

        action = body.get("action")
        if not action:
            # Backward compat: if no action but has "data", treat as save_all
            if "data" in body:
                action = "save_all"
            else:
                return error(400, "Missing 'action' in request body")

        handler_fn = POST_ACTIONS.get(action)
        if not handler_fn:
            return error(400, f"Unknown POST action: {action}")

        conn = get_conn()
        try:
            cur = conn.cursor()
            handler_fn(cur, body)
            # Get current timestamp
            cur.execute("SELECT NOW()")
            now_row = cur.fetchone()
            updated_at = now_row[0].isoformat() if now_row else None
            conn.commit()
            return ok({"ok": True, "updatedAt": updated_at})
        except Exception as e:
            conn.rollback()
            return error(500, str(e))
        finally:
            conn.close()

    return error(405, "Method not allowed")