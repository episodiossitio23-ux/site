/*
# Add administrative customer and order history support

1. New table
- `order_status_history`: immutable operational history with order, previous status, new status, actor and timestamp.

2. Behavior
- A trigger records every status change made to an order.
- Existing orders are not changed or deleted.

3. Security
- RLS is enabled.
- Only authenticated administrators can read history.
- The trigger writes history internally; customers cannot write or read it.
*/

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history(order_id, created_at DESC);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON order_status_history TO authenticated;
DROP POLICY IF EXISTS "admins_read_order_status_history" ON order_status_history;
CREATE POLICY "admins_read_order_status_history" ON order_status_history FOR SELECT TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_history_trigger ON orders;
CREATE TRIGGER orders_status_history_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION record_order_status_change();

REVOKE EXECUTE ON FUNCTION record_order_status_change() FROM PUBLIC, anon, authenticated;