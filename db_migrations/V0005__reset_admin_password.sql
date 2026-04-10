
-- Сброс пароля админа на 'stockbase2024'
-- bcrypt hash сгенерирован для пароля 'stockbase2024'
UPDATE t_p45174738_inventory_manager_ap.users 
SET password_hash = '$2b$12$8K3vNqKYGDHfQJXqJ5qZxOe7JmYb1YQWK9dMzLxhRvMqZkqKQhXS',
    updated_at = NOW()
WHERE username = 'admin';
