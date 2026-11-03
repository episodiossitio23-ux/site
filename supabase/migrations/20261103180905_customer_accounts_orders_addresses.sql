/*
# Customer accounts: link orders, saved addresses, tracking code and own-order access

Plain-English summary: lets shoppers create an account, see their own orders, follow production and shipping, save delivery addresses and download their original photos to repeat an order. Guests can still buy without an account.

1. New Tables
- `customer_addresses`: delivery addresses saved by a shopper. Each row belongs to one account.

2. Modified Tables
- `orders`: new `customer_id` column with the account that placed the order. It is filled automatically when a signed-in shopper checks out; guest orders stay empty. New `tracking_code` column, written by the store when the parcel ships.
- `get_order_by_token`: also returns the tracking code so the public order link shows it.

3. Security
- `customer_addresses`: row level security on; each shopper can read, add, edit and delete only their own addresses, with one policy per action.
- `orders`: shoppers can read only orders whose `customer_id` is their own account. They cannot change orders.
- `order_items`: shoppers can read only items of their own orders.
- Storage `print-files`: shoppers can download only the original photos of their own orders.
- Store administrators can also write `tracking_code`; nothing else on orders changes.

# Important notes
1. Orders placed while signed out are not linked to any account and will not appear in account history.
2. Account ownership is set by the database from the signed-in session, never from data sent by the browser.
3. Dropping, renaming or changing column types is not part of this migration.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);

GRANT UPDATE (tracking_code) ON orders TO authenticated;

DROP POLICY IF EXISTS "customers_read_own_orders" ON orders;
CREATE POLICY "customers_read_own_orders" ON orders FOR SELECT
TO authenticated USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "customers_read_own_order_items" ON order_items;
CREATE POLICY "customers_read_own_order_items" ON order_items FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid())
);

DROP POLICY IF EXISTS "customers_read_own_original_photos" ON storage.objects;
CREATE POLICY "customers_read_own_original_photos" ON storage.objects FOR SELECT
TO authenticated USING (
  bucket_id = 'print-files' AND EXISTS (
    SELECT 1 FROM order_items i
    JOIN orders o ON o.id = i.order_id
    WHERE i.original_path = storage.objects.name AND o.customer_id = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 40),
  cep text NOT NULL CHECK (cep ~ '^[0-9]{8}$'),
  street text NOT NULL CHECK (char_length(street) BETWEEN 2 AND 160),
  number text NOT NULL CHECK (char_length(number) BETWEEN 1 AND 20),
  complement text NOT NULL DEFAULT '' CHECK (char_length(complement) <= 120),
  neighborhood text NOT NULL CHECK (char_length(neighborhood) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 120),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_addresses_user_id_idx ON customer_addresses(user_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_addresses TO authenticated;

DROP POLICY IF EXISTS "select_own_addresses" ON customer_addresses;
CREATE POLICY "select_own_addresses" ON customer_addresses FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON customer_addresses;
CREATE POLICY "insert_own_addresses" ON customer_addresses FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON customer_addresses;
CREATE POLICY "update_own_addresses" ON customer_addresses FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON customer_addresses;
CREATE POLICY "delete_own_addresses" ON customer_addresses FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_order_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'tracking_code', o.tracking_code,
    'fulfillment_type', o.fulfillment_type,
    'pickup_address', o.pickup_address,
    'shipping_method_name', o.shipping_method_name,
    'delivery', jsonb_build_object(
      'cep', o.delivery_cep,
      'street', o.delivery_street,
      'number', o.delivery_number,
      'complement', o.delivery_complement,
      'neighborhood', o.delivery_neighborhood,
      'city', o.delivery_city,
      'state', o.delivery_state
    ),
    'subtotal_cents', o.subtotal_cents,
    'shipping_cents', o.shipping_cents,
    'total_cents', o.total_cents,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'format_label', i.format_label,
        'format_kind', i.format_kind,
        'unit_price_cents', i.unit_price_cents,
        'quantity', i.quantity,
        'line_total_cents', i.line_total_cents,
        'caption', i.caption,
        'original_name', i.original_name
      ) ORDER BY i.position)
      FROM order_items i WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.access_token = p_token;
$$;
