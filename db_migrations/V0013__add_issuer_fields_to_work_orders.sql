ALTER TABLE t_p45174738_inventory_manager_ap.work_orders
  ADD COLUMN IF NOT EXISTS issuer_rank TEXT,
  ADD COLUMN IF NOT EXISTS issuer_name TEXT;