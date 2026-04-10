
UPDATE t_p45174738_inventory_manager_ap.users 
SET password_hash = 'admin123',
    updated_at = NOW()
WHERE username = 'admin';
