ALTER TABLE t_p45174738_inventory_manager_ap.warehouses
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS sender_dept text,
  ADD COLUMN IF NOT EXISTS issuer_rank text,
  ADD COLUMN IF NOT EXISTS issuer_name text,
  ADD COLUMN IF NOT EXISTS approver_role text,
  ADD COLUMN IF NOT EXISTS approver_name text;
