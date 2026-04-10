
-- Пользователи
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.users (
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
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p45174738_inventory_manager_ap.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p45174738_inventory_manager_ap.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON t_p45174738_inventory_manager_ap.sessions(expires_at);

-- Админ по умолчанию (пароль: admin)
INSERT INTO t_p45174738_inventory_manager_ap.users (id, username, password_hash, display_name, role)
VALUES (
  'user-admin-1',
  'admin',
  '$2b$12$LJ3m4ys3Lz0QqV9NKXJ8auYPGKGK.Y2oAmFvBlGEfMNhzVmFdcKa',
  'Администратор',
  'admin'
)
ON CONFLICT (id) DO NOTHING;
