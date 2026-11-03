/*
# Allow customers to read their own order timeline

1. Security change
- Adds a SELECT policy allowing signed-in customers to read history rows belonging to their own orders.
- Administrators retain access through the existing admin policy.
- Anonymous visitors continue using only the private-token function.
*/

DROP POLICY IF EXISTS "customers_read_own_order_status_history" ON order_status_history;
CREATE POLICY "customers_read_own_order_status_history" ON order_status_history FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.customer_id = auth.uid())
);