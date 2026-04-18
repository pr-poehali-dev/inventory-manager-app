ALTER TABLE t_p45174738_inventory_manager_ap.work_orders
  ADD COLUMN IF NOT EXISTS requester_rank TEXT,
  ADD COLUMN IF NOT EXISTS requester_name TEXT;