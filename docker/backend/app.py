"""
Локальный backend-сервер для docker-compose.
Заменяет serverless-функцию state из /backend/state/index.py.
Поддерживает многопользовательский режим через общую PostgreSQL БД.
"""

import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras

app = Flask(__name__)
CORS(app)

SCHEMA = os.environ.get("DB_SCHEMA", "public")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ensure_table():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.app_state (
            id INTEGER PRIMARY KEY DEFAULT 1,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT single_row CHECK (id = 1)
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


@app.route("/api/state", methods=["GET", "POST", "OPTIONS"])
def state_handler():
    if request.method == "OPTIONS":
        return "", 200

    if request.method == "GET":
        check_only = request.args.get("check") == "1"
        conn = get_conn()
        cur = conn.cursor()

        if check_only:
            cur.execute(f"SELECT updated_at FROM {SCHEMA}.app_state WHERE id = 1")
            row = cur.fetchone()
            cur.close()
            conn.close()
            if not row:
                return jsonify({"updatedAt": None})
            return jsonify({"updatedAt": row[0].isoformat()})

        cur.execute(f"SELECT data, updated_at FROM {SCHEMA}.app_state WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return jsonify({"data": None, "updatedAt": None})

        return jsonify({"data": row[0], "updatedAt": row[1].isoformat()})

    if request.method == "POST":
        body = request.get_json(force=True)
        state_data = body.get("data")
        if state_data is None:
            return jsonify({"error": "missing data"}), 400

        json_str = json.dumps(state_data, ensure_ascii=False)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.app_state (id, data, updated_at)
            VALUES (1, %s::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE
              SET data = EXCLUDED.data, updated_at = NOW()
            """,
            (json_str,),
        )
        cur.execute("SELECT NOW()")
        updated_at = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True, "updatedAt": updated_at.isoformat()})

    return jsonify({"error": "method not allowed"}), 405


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
    ensure_table()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
