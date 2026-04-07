import json
import os
import urllib.parse
import pg8000.native

SCHEMA = "t_p45174738_inventory_manager_ap"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    url = urllib.parse.urlparse(os.environ["DATABASE_URL"])
    return pg8000.native.Connection(
        user=urllib.parse.unquote(url.username or ""),
        password=urllib.parse.unquote(url.password or ""),
        host=url.hostname,
        port=url.port or 5432,
        database=url.path.lstrip("/"),
        ssl_context=False,
    )


def handler(event: dict, context) -> dict:
    """GET — вернуть текущее состояние; POST — сохранить новое состояние."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        conn = get_conn()
        rows = conn.run(f"SELECT data, updated_at FROM {SCHEMA}.app_state WHERE id = 1")
        conn.close()

        if not rows:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"data": None, "updatedAt": None}),
            }

        data, updated_at = rows[0]
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"data": data, "updatedAt": updated_at.isoformat()}),
        }

    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        state_data = body.get("data")
        if state_data is None:
            return {
                "statusCode": 400,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "missing data"}),
            }

        json_str = json.dumps(state_data, ensure_ascii=False).replace("'", "''")
        conn = get_conn()
        conn.run(
            f"""
            INSERT INTO {SCHEMA}.app_state (id, data, updated_at)
            VALUES (1, '{json_str}'::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE
              SET data = EXCLUDED.data, updated_at = NOW()
            """
        )
        ts_rows = conn.run("SELECT NOW()")
        conn.close()

        updated_at = ts_rows[0][0]
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"ok": True, "updatedAt": updated_at.isoformat()}),
        }

    return {
        "statusCode": 405,
        "headers": CORS,
        "body": json.dumps({"error": "method not allowed"}),
    }