"""
API аутентификации для приложения управления складом.

Обрабатывает вход, выход, регистрацию пользователей, смену паролей
и управление пользователями. Маршрутизация по параметру action
(queryStringParameters для GET, body для POST).
"""

import json
import os
import urllib.parse
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import psycopg2
import psycopg2.extras

# ── Constants ─────────────────────────────────────────────────────────────────

SCHEMA = "t_p45174738_inventory_manager_ap"

SESSION_TTL_DAYS = 30

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

JSON_HEADERS = {**CORS, "Content-Type": "application/json"}


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _json_serial(obj):
    """Сериализация datetime для JSON."""
    if isinstance(obj, datetime):
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


def _table(name: str) -> str:
    """Полное имя таблицы со схемой."""
    return f"{SCHEMA}.{name}"


# ── Response helpers ──────────────────────────────────────────────────────────

def _ok(data=None, status: int = 200) -> dict:
    """Успешный ответ."""
    body = data if data is not None else {"ok": True}
    return {
        "statusCode": status,
        "headers": JSON_HEADERS,
        "body": _json_dumps(body),
    }


def _error(status: int, msg: str) -> dict:
    """Ответ с ошибкой."""
    return {
        "statusCode": status,
        "headers": JSON_HEADERS,
        "body": _json_dumps({"error": msg}),
    }


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _get_token(event: dict) -> str | None:
    """Извлечь токен из заголовков запроса."""
    headers = event.get("headers") or {}
    return headers.get("X-Auth-Token") or headers.get("x-auth-token")


def _hash_password(password: str) -> str:
    """Хешировать пароль с bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    """Проверить пароль по хешу bcrypt. Поддерживает fallback на plaintext."""
    if password_hash.startswith("$2"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except Exception:
            return False
    # Fallback: если хеш не bcrypt — сравниваем как plaintext
    return password == password_hash


def _authenticate(cur, event: dict) -> dict | None:
    """
    Проверить токен сессии и вернуть данные пользователя.
    Возвращает None если токен невалиден или сессия истекла.
    """
    token = _get_token(event)
    if not token:
        return None

    cur.execute(
        f"""
        SELECT s.user_id, s.expires_at, u.id, u.username, u.display_name, u.role, u.is_active
        FROM {_table('sessions')} s
        JOIN {_table('users')} u ON u.id = s.user_id
        WHERE s.token = %s
        """,
        (token,),
    )
    row = cur.fetchone()
    if not row:
        return None

    _user_id, expires_at, uid, username, display_name, role, is_active = row

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        return None

    if not is_active:
        return None

    return {
        "id": uid,
        "username": username,
        "displayName": display_name,
        "role": role,
    }


def _require_auth(cur, event: dict) -> tuple[dict | None, dict | None]:
    """
    Требуется аутентификация. Возвращает (user, error_response).
    Если user is None — вернуть error_response клиенту.
    """
    user = _authenticate(cur, event)
    if user is None:
        return None, _error(401, "unauthorized")
    return user, None


def _require_admin(cur, event: dict) -> tuple[dict | None, dict | None]:
    """
    Требуется роль admin. Возвращает (user, error_response).
    """
    user, err = _require_auth(cur, event)
    if err:
        return None, err
    if user["role"] != "admin":
        return None, _error(403, "forbidden")
    return user, None


def _format_user(row: dict) -> dict:
    """Форматировать данные пользователя для ответа (без пароля)."""
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "role": row["role"],
    }


# ── Cleanup ───────────────────────────────────────────────────────────────────

def _cleanup_expired_sessions(cur):
    """Удалить просроченные сессии."""
    cur.execute(
        f"DELETE FROM {_table('sessions')} WHERE expires_at < %s",
        (datetime.now(timezone.utc),),
    )


# ── POST actions ──────────────────────────────────────────────────────────────

def _ensure_admin_exists(cur):
    """Убедиться, что пользователь admin существует с рабочим паролем 'admin'."""
    cur.execute(
        f"SELECT id, password_hash FROM {_table('users')} WHERE username = %s",
        ("admin",),
    )
    row = cur.fetchone()
    if not row:
        # Создаём admin если его нет
        admin_id = "user-admin-1"
        now = datetime.now(timezone.utc)
        cur.execute(
            f"""
            INSERT INTO {_table('users')} (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (admin_id, "admin", _hash_password("admin"), "Администратор", "admin", True, now, now),
        )
    else:
        uid, password_hash = row
        # Если хеш не соответствует 'admin' — сбрасываем пароль
        if not _verify_password("admin", password_hash):
            cur.execute(
                f"UPDATE {_table('users')} SET password_hash = %s, updated_at = %s WHERE id = %s",
                (_hash_password("admin"), datetime.now(timezone.utc), uid),
            )


def _action_login(cur, body: dict, event: dict) -> dict:
    """Вход пользователя по логину и паролю."""
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return _error(400, "Имя пользователя и пароль обязательны")

    cur.execute(
        f"SELECT id, username, password_hash, display_name, role, is_active "
        f"FROM {_table('users')} WHERE username = %s",
        (username,),
    )
    row = cur.fetchone()

    if not row:
        return _error(401, "Неверный логин или пароль")

    uid, db_username, password_hash, display_name, role, is_active = row

    if not is_active:
        return _error(401, "Учётная запись деактивирована")

    if not _verify_password(password, password_hash):
        return _error(401, "Неверный логин или пароль")

    # Авто-обновление plaintext пароля до bcrypt хеша
    if not password_hash.startswith("$2"):
        new_hash = _hash_password(password)
        cur.execute(
            f"UPDATE {_table('users')} SET password_hash = %s, updated_at = %s WHERE id = %s",
            (new_hash, datetime.now(timezone.utc), uid),
        )

    # Очистка просроченных сессий
    _cleanup_expired_sessions(cur)

    # Создание новой сессии
    session_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    ip_address = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "")

    cur.execute(
        f"""
        INSERT INTO {_table('sessions')} (id, user_id, token, expires_at, created_at, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (session_id, uid, token, expires_at, datetime.now(timezone.utc), ip_address),
    )

    return _ok({
        "ok": True,
        "token": token,
        "user": {
            "id": uid,
            "username": db_username,
            "displayName": display_name,
            "role": role,
        },
    })


def _action_logout(cur, event: dict) -> dict:
    """Выход — удаление текущей сессии."""
    token = _get_token(event)
    if not token:
        return _error(401, "unauthorized")

    cur.execute(
        f"DELETE FROM {_table('sessions')} WHERE token = %s",
        (token,),
    )
    return _ok()


def _action_register(cur, body: dict, event: dict) -> dict:
    """Регистрация нового пользователя (только для администратора)."""
    admin, err = _require_admin(cur, event)
    if err:
        return err

    username = body.get("username", "").strip()
    password = body.get("password", "")
    display_name = body.get("displayName", "").strip()
    role = body.get("role", "viewer")

    if not username or not password:
        return _error(400, "Имя пользователя и пароль обязательны")

    if role not in ("admin", "warehouse", "viewer"):
        return _error(400, "Недопустимая роль")

    # Проверка уникальности username
    cur.execute(
        f"SELECT id FROM {_table('users')} WHERE username = %s",
        (username,),
    )
    if cur.fetchone():
        return _error(409, "Пользователь с таким именем уже существует")

    user_id = str(uuid.uuid4())
    password_hash = _hash_password(password)
    now = datetime.now(timezone.utc)

    cur.execute(
        f"""
        INSERT INTO {_table('users')} (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, username, password_hash, display_name or username, role, True, now, now),
    )

    return _ok({
        "ok": True,
        "user": {
            "id": user_id,
            "username": username,
            "displayName": display_name or username,
            "role": role,
        },
    })


def _action_change_password(cur, body: dict, event: dict) -> dict:
    """Смена пароля (админ может менять любому, остальные — только себе)."""
    caller, err = _require_auth(cur, event)
    if err:
        return err

    user_id = body.get("userId", "").strip()
    new_password = body.get("newPassword", "")

    if not user_id or not new_password:
        return _error(400, "userId и newPassword обязательны")

    # Неадмин может менять только свой пароль
    if caller["role"] != "admin" and caller["id"] != user_id:
        return _error(403, "forbidden")

    # Проверяем существование пользователя
    cur.execute(
        f"SELECT id FROM {_table('users')} WHERE id = %s",
        (user_id,),
    )
    if not cur.fetchone():
        return _error(404, "Пользователь не найден")

    password_hash = _hash_password(new_password)
    now = datetime.now(timezone.utc)

    cur.execute(
        f"UPDATE {_table('users')} SET password_hash = %s, updated_at = %s WHERE id = %s",
        (password_hash, now, user_id),
    )

    return _ok()


def _action_update_user(cur, body: dict, event: dict) -> dict:
    """Обновление данных пользователя (только для администратора)."""
    admin, err = _require_admin(cur, event)
    if err:
        return err

    user_id = body.get("userId", "").strip()
    if not user_id:
        return _error(400, "userId обязателен")

    # Проверяем существование
    cur.execute(
        f"SELECT id FROM {_table('users')} WHERE id = %s",
        (user_id,),
    )
    if not cur.fetchone():
        return _error(404, "Пользователь не найден")

    # Собираем поля для обновления
    updates = []
    params = []

    if "displayName" in body:
        updates.append("display_name = %s")
        params.append(body["displayName"])

    if "role" in body:
        if body["role"] not in ("admin", "warehouse", "viewer"):
            return _error(400, "Недопустимая роль")
        updates.append("role = %s")
        params.append(body["role"])

    if "isActive" in body:
        updates.append("is_active = %s")
        params.append(bool(body["isActive"]))

    if not updates:
        return _error(400, "Нет полей для обновления")

    updates.append("updated_at = %s")
    params.append(datetime.now(timezone.utc))
    params.append(user_id)

    cur.execute(
        f"UPDATE {_table('users')} SET {', '.join(updates)} WHERE id = %s",
        params,
    )

    return _ok()


def _action_delete_user(cur, body: dict, event: dict) -> dict:
    """Удаление пользователя (только для администратора, нельзя удалить себя)."""
    admin, err = _require_admin(cur, event)
    if err:
        return err

    user_id = body.get("userId", "").strip()
    if not user_id:
        return _error(400, "userId обязателен")

    if admin["id"] == user_id:
        return _error(400, "Нельзя удалить собственную учётную запись")

    # Проверяем существование
    cur.execute(
        f"SELECT id FROM {_table('users')} WHERE id = %s",
        (user_id,),
    )
    if not cur.fetchone():
        return _error(404, "Пользователь не найден")

    # Удаляем сессии пользователя
    cur.execute(
        f"DELETE FROM {_table('sessions')} WHERE user_id = %s",
        (user_id,),
    )

    # Удаляем пользователя
    cur.execute(
        f"DELETE FROM {_table('users')} WHERE id = %s",
        (user_id,),
    )

    return _ok()


# ── GET actions ───────────────────────────────────────────────────────────────

def _action_me(cur, event: dict) -> dict:
    """Получить текущего пользователя по токену сессии."""
    user = _authenticate(cur, event)
    if user is None:
        return _error(401, "unauthorized")
    return _ok({"user": user})


def _action_list_users(cur, event: dict) -> dict:
    """Список всех пользователей (только для администратора)."""
    admin, err = _require_admin(cur, event)
    if err:
        return err

    cur.execute(
        f"SELECT id, username, display_name, role, is_active, created_at "
        f"FROM {_table('users')} ORDER BY created_at"
    )
    cols = [desc[0] for desc in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    users = []
    for row in rows:
        users.append({
            "id": row["id"],
            "username": row["username"],
            "displayName": row["display_name"],
            "role": row["role"],
            "isActive": row["is_active"],
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        })

    return _ok({"users": users})


# ── Route tables ──────────────────────────────────────────────────────────────

POST_ACTIONS = {
    "login": lambda cur, body, event: _action_login(cur, body, event),
    "logout": lambda cur, body, event: _action_logout(cur, event),
    "register": lambda cur, body, event: _action_register(cur, body, event),
    "change_password": lambda cur, body, event: _action_change_password(cur, body, event),
    "update_user": lambda cur, body, event: _action_update_user(cur, body, event),
    "delete_user": lambda cur, body, event: _action_delete_user(cur, body, event),
}

GET_ACTIONS = {
    "me": lambda cur, event: _action_me(cur, event),
    "list_users": lambda cur, event: _action_list_users(cur, event),
}


# ── Main handler ──────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Точка входа — обработчик Lambda для API аутентификации."""

    method = event.get("httpMethod", "GET")

    # OPTIONS — preflight CORS
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            action = body.get("action", "")

            # Гарантируем существование admin при попытке входа
            if action == "login":
                _ensure_admin_exists(cur)

            action_fn = POST_ACTIONS.get(action)
            if not action_fn:
                return _error(400, f"Неизвестное действие: {action}")

            response = action_fn(cur, body, event)
            conn.commit()
            return response

        if method == "GET":
            params = event.get("queryStringParameters") or {}
            action = params.get("action", "")

            action_fn = GET_ACTIONS.get(action)
            if not action_fn:
                return _error(400, f"Неизвестное действие: {action}")

            response = action_fn(cur, event)
            conn.commit()
            return response

        return _error(405, "Method not allowed")

    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return _error(500, f"Internal error: {str(e)}")

    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass