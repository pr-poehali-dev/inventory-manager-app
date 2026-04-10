"""
Отправка уведомлений в Telegram о складских событиях.

Поддерживаемые действия:
  - test              — проверка подключения
  - send_low_stock    — уведомление о низких остатках
  - send_operation    — уведомление о приходе/расходе
  - send_message      — произвольное текстовое сообщение
"""

import json
import os
import urllib.request

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _ok(data=None):
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data or {"ok": True}),
    }


def _error(msg, code=400):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"error": msg}),
    }


def _send_telegram(chat_id, text, parse_mode="HTML"):
    """Send a message via Telegram Bot API using only stdlib."""
    if not TELEGRAM_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = json.dumps(
        {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    ).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception:
        return False


# ── Handler ───────────────────────────────────────────────────────────────────


def handler(event, context):
    """Точка входа — маршрутизация по полю action в теле запроса."""

    # CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    action = body.get("action", "")
    chat_id = body.get("chatId", "")

    if not chat_id:
        return _error("chatId обязателен")

    # ── Validate action + inputs before checking token ────────────────────

    if action == "send_low_stock":
        items = body.get("items", [])
        if not items:
            return _ok({"ok": True, "skipped": True})

    if action == "send_message":
        if not body.get("text", ""):
            return _error("text обязателен")

    if action not in ("test", "send_low_stock", "send_operation", "send_message"):
        return _error(f"Неизвестное действие: {action}")

    # ── Token required from this point on ─────────────────────────────────

    if not TELEGRAM_TOKEN:
        return _error("TELEGRAM_BOT_TOKEN не настроен", 500)

    # ── test ──────────────────────────────────────────────────────────────
    if action == "test":
        ok = _send_telegram(
            chat_id,
            "\u2705 <b>StockBase подключен!</b>\nУведомления работают.",
        )
        return _ok() if ok else _error("Не удалось отправить. Проверьте chat ID.")

    # ── send_low_stock ────────────────────────────────────────────────────
    if action == "send_low_stock":
        items = body.get("items", [])
        lines = ["\u26a0\ufe0f <b>Низкий остаток!</b>\n"]
        for it in items:
            name = it.get("name", "?")
            qty = it.get("quantity", 0)
            unit = it.get("unit", "шт")
            threshold = it.get("threshold", 0)
            lines.append(f"\u2022 <b>{name}</b> — {qty} {unit} (порог: {threshold})")
        lines.append(f"\nТоваров с низким остатком: {len(items)}")
        ok = _send_telegram(chat_id, "\n".join(lines))
        return _ok() if ok else _error("Ошибка отправки")

    # ── send_operation ────────────────────────────────────────────────────
    if action == "send_operation":
        item_name = body.get("itemName", "?")
        op_type = body.get("type", "in")
        qty = body.get("quantity", 0)
        who = body.get("performedBy", "?")
        emoji = "\U0001f4e5" if op_type == "in" else "\U0001f4e4"
        type_label = "Приход" if op_type == "in" else "Расход"
        text = f"{emoji} <b>{type_label}</b>\n{item_name} \u00d7 {qty}\nИсполнитель: {who}"
        ok = _send_telegram(chat_id, text)
        return _ok() if ok else _error("Ошибка отправки")

    # ── send_message ──────────────────────────────────────────────────────
    if action == "send_message":
        text = body.get("text", "")
        ok = _send_telegram(chat_id, text)
        return _ok() if ok else _error("Ошибка отправки")

    return _error("Непредвиденная ошибка", 500)