CREATE TABLE IF NOT EXISTS store_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  pickup_address text NOT NULL DEFAULT '',
  pickup_hours text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON store_settings TO anon, authenticated;
GRANT UPDATE (store_name, contact_email, contact_phone, pickup_address, pickup_hours, updated_at) ON store_settings TO authenticated;

DROP POLICY IF EXISTS "anyone_reads_store_settings" ON store_settings;
CREATE POLICY "anyone_reads_store_settings" ON store_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins_update_store_settings" ON store_settings;
CREATE POLICY "admins_update_store_settings" ON store_settings FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 160),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON shipping_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON shipping_methods TO authenticated;

DROP POLICY IF EXISTS "anyone_reads_active_shipping" ON shipping_methods;
CREATE POLICY "anyone_reads_active_shipping" ON shipping_methods FOR SELECT
TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admins_read_all_shipping" ON shipping_methods;
CREATE POLICY "admins_read_all_shipping" ON shipping_methods FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_shipping" ON shipping_methods;
CREATE POLICY "admins_insert_shipping" ON shipping_methods FOR INSERT
TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_update_shipping" ON shipping_methods;
CREATE POLICY "admins_update_shipping" ON shipping_methods FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_delete_shipping" ON shipping_methods;
CREATE POLICY "admins_delete_shipping" ON shipping_methods FOR DELETE
TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS smtp_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active boolean NOT NULL DEFAULT false,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587 CHECK (port BETWEEN 1 AND 65535),
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO smtp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (is_active, host, port, secure, username, password, from_name, from_email, updated_at) ON smtp_settings TO authenticated;

DROP POLICY IF EXISTS "admins_read_smtp" ON smtp_settings;
CREATE POLICY "admins_read_smtp" ON smtp_settings FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_update_smtp" ON smtp_settings;
CREATE POLICY "admins_update_smtp" ON smtp_settings FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, UPDATE (label, price_cents, is_active) ON print_formats TO authenticated;

DROP POLICY IF EXISTS "admins_read_all_formats" ON print_formats;
CREATE POLICY "admins_read_all_formats" ON print_formats FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_update_formats" ON print_formats;
CREATE POLICY "admins_update_formats" ON print_formats FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'envio'
  CHECK (fulfillment_type IN ('envio', 'retirada'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_name text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_address text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS create_order(jsonb, jsonb);

CREATE OR REPLACE FUNCTION create_order(p_customer jsonb, p_items jsonb, p_fulfillment jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_order_id uuid;
  v_number bigint;
  v_token uuid;
  v_item jsonb;
  v_format print_formats%ROWTYPE;
  v_ship shipping_methods%ROWTYPE;
  v_store store_settings%ROWTYPE;
  v_type text;
  v_qty integer;
  v_subtotal integer := 0;
  v_shipping integer := 0;
  v_pos integer := 0;
  v_original text;
  v_print text;
  v_name text;
  v_email text;
  v_phone text;
  v_cep text := '';
  v_street text := '';
  v_house_number text := '';
  v_complement text := '';
  v_neighborhood text := '';
  v_city text := '';
  v_state text := '';
  v_ship_name text := '';
  v_pickup text := '';
BEGIN
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Dados do cliente inválidos.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa de pelo menos uma foto.';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'O pedido aceita no máximo 200 itens.';
  END IF;

  v_name := left(trim(coalesce(p_customer->>'name', '')), 120);
  v_email := left(trim(coalesce(p_customer->>'email', '')), 254);
  v_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');

  IF length(v_name) < 3 OR position(' ' IN v_name) = 0 THEN
    RAISE EXCEPTION 'Informe o nome completo.';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Informe um telefone válido.';
  END IF;

  v_type := coalesce(p_fulfillment->>'type', '');
  IF v_type = 'retirada' THEN
    SELECT * INTO v_store FROM store_settings WHERE id = 1;
    v_pickup := coalesce(v_store.pickup_address, '');
    IF v_pickup = '' THEN
      RAISE EXCEPTION 'A retirada na loja não está disponível no momento.';
    END IF;
  ELSIF v_type = 'envio' THEN
    v_cep := regexp_replace(coalesce(p_customer->>'cep', ''), '\D', '', 'g');
    IF length(v_cep) <> 8 THEN
      RAISE EXCEPTION 'Informe um CEP válido.';
    END IF;
    IF length(trim(coalesce(p_customer->>'street', ''))) < 2
       OR length(trim(coalesce(p_customer->>'number', ''))) < 1
       OR length(trim(coalesce(p_customer->>'neighborhood', ''))) < 2
       OR length(trim(coalesce(p_customer->>'city', ''))) < 2
       OR length(trim(coalesce(p_customer->>'state', ''))) <> 2 THEN
      RAISE EXCEPTION 'Preencha o endereço de entrega completo.';
    END IF;
    v_street := left(trim(p_customer->>'street'), 160);
    v_house_number := left(trim(p_customer->>'number'), 20);
    v_complement := left(trim(coalesce(p_customer->>'complement', '')), 120);
    v_neighborhood := left(trim(p_customer->>'neighborhood'), 120);
    v_city := left(trim(p_customer->>'city'), 120);
    v_state := upper(left(trim(p_customer->>'state'), 2));

    SELECT * INTO v_ship FROM shipping_methods
    WHERE id = (p_fulfillment->>'shipping_method_id')::uuid AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A forma de envio escolhida não está disponível.';
    END IF;
    v_shipping := v_ship.price_cents;
    v_ship_name := v_ship.name;
  ELSE
    RAISE EXCEPTION 'Escolha como deseja receber o pedido.';
  END IF;

  INSERT INTO orders (
    customer_name, customer_email, customer_phone,
    delivery_cep, delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_city, delivery_state,
    fulfillment_type, shipping_method_name, shipping_cents, pickup_address
  ) VALUES (
    v_name, v_email, v_phone,
    v_cep, v_street, v_house_number, v_complement,
    v_neighborhood, v_city, v_state,
    v_type, v_ship_name, v_shipping, v_pickup
  )
  RETURNING id, order_number, access_token INTO v_order_id, v_number, v_token;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_pos := v_pos + 1;

    SELECT * INTO v_format
    FROM print_formats
    WHERE id = (v_item->>'format_id')::uuid AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um dos formatos escolhidos não está disponível.';
    END IF;

    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    IF v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'A quantidade de cada foto deve estar entre 1 e 100.';
    END IF;

    v_original := v_item->>'original_path';
    v_print := v_item->>'print_path';
    IF v_original IS NULL OR v_original !~ '^sessions/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$'
       OR v_print IS NULL OR v_print !~ '^sessions/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$' THEN
      RAISE EXCEPTION 'Arquivo de foto inválido.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'print-files' AND name = v_original)
       OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'print-files' AND name = v_print) THEN
      RAISE EXCEPTION 'Algumas fotos não foram enviadas. Tente novamente.';
    END IF;

    v_subtotal := v_subtotal + v_format.price_cents * v_qty;

    INSERT INTO order_items (
      order_id, position, format_id, format_label, format_kind,
      unit_price_cents, quantity, line_total_cents,
      caption, caption_style, crop_settings,
      original_name, original_path, print_path
    ) VALUES (
      v_order_id, v_pos, v_format.id, v_format.label, v_format.kind,
      v_format.price_cents, v_qty, v_format.price_cents * v_qty,
      left(coalesce(v_item->>'caption', ''), 200),
      CASE WHEN jsonb_typeof(v_item->'caption_style') = 'object' THEN v_item->'caption_style' ELSE '{}'::jsonb END,
      CASE WHEN jsonb_typeof(v_item->'crop_settings') = 'object' THEN v_item->'crop_settings' ELSE '{}'::jsonb END,
      left(coalesce(v_item->>'original_name', 'foto'), 255),
      v_original,
      v_print
    );
  END LOOP;

  UPDATE orders
  SET subtotal_cents = v_subtotal,
      total_cents = v_subtotal + v_shipping,
      updated_at = now()
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_number,
    'access_token', v_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order(jsonb, jsonb, jsonb) TO anon, authenticated;

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

REVOKE EXECUTE ON FUNCTION get_order_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_order_by_token(uuid) TO anon, authenticated;
