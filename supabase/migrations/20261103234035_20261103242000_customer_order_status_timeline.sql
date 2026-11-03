/*
# Expose the order timeline to customers

1. Modified function
- `get_order_by_token` now includes the public status timeline for the order link.

2. Security
- The function still returns data only when the caller has the private order token.
- No direct access to the internal history table is granted to anonymous visitors.
- Account customers continue using their existing row-level policies.
*/

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
    'status_history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'previous_status', h.previous_status,
        'new_status', h.new_status,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM order_status_history h WHERE h.order_id = o.id
    ), '[]'::jsonb),
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

REVOKE EXECUTE ON FUNCTION get_order_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_order_by_token(uuid) TO anon, authenticated;