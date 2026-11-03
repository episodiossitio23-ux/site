/*
# Photo store core: print formats, orders, private file storage

Plain-English summary: creates the catalog of print sizes, the orders and order items tables, a private storage bucket for customer photos, and two secure functions the website uses to place an order and to show an order to the customer who owns its secret link.

1. New Tables
- `print_formats`: print sizes (traditional, square, Polaroid) with prices stored in cents. Visitors can read active rows only.
- `orders`: one row per checkout (order number, customer data, delivery address, totals, status, private access token).
- `order_items`: each photo in an order, with the size and price snapshot, caption, crop settings and storage paths.

2. Storage
- Private bucket `print-files`. No public links. Visitors may upload only inside the `sessions/` folder, and nobody can list or read files through the public API.

3. Functions
- `create_order(p_customer, p_items)`: validates the data, prices every item from `print_formats` (the browser price is never trusted), checks the uploaded files exist, and writes the order atomically.
- `get_order_by_token(p_token)`: returns one order only when the caller knows its secret token.

4. Security
- RLS enabled on every table.
- `print_formats`: visitors can SELECT active rows only.
- `orders` and `order_items`: no direct grants or policies for visitors. Data is reachable only through the two functions.
- Both functions: EXECUTE granted to visitors explicitly; PUBLIC access revoked.

# Important notes
1. Totals are calculated on the server from the catalog prices.
2. Customer data is validated server-side as well as in the form.
3. The order access token is a random UUID, so order links cannot be guessed.
*/

CREATE TABLE IF NOT EXISTS print_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('tradicional', 'quadrada', 'polaroid')),
  width_cm numeric(5,2) NOT NULL CHECK (width_cm > 0),
  height_cm numeric(5,2) NOT NULL CHECK (height_cm > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_formats ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON print_formats TO anon, authenticated;

DROP POLICY IF EXISTS "anyone_reads_active_formats" ON print_formats;
CREATE POLICY "anyone_reads_active_formats" ON print_formats FOR SELECT
TO anon, authenticated USING (is_active);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (status IN (
    'aguardando_pagamento', 'pagamento_aprovado', 'aguardando_producao', 'em_producao',
    'aguardando_conferencia', 'pronto_envio', 'enviado', 'entregue', 'cancelado'
  )),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  delivery_cep text NOT NULL,
  delivery_street text NOT NULL,
  delivery_number text NOT NULL,
  delivery_complement text NOT NULL DEFAULT '',
  delivery_neighborhood text NOT NULL,
  delivery_city text NOT NULL,
  delivery_state text NOT NULL,
  subtotal_cents integer NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position integer NOT NULL,
  format_id uuid NOT NULL REFERENCES print_formats(id),
  format_label text NOT NULL,
  format_kind text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  caption text NOT NULL DEFAULT '',
  caption_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  crop_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  original_name text NOT NULL,
  original_path text NOT NULL,
  print_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('print-files', 'print-files', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "visitors_upload_session_files" ON storage.objects;
CREATE POLICY "visitors_upload_session_files" ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'print-files' AND (storage.foldername(name))[1] = 'sessions');

CREATE OR REPLACE FUNCTION create_order(p_customer jsonb, p_items jsonb)
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
  v_qty integer;
  v_subtotal integer := 0;
  v_pos integer := 0;
  v_original text;
  v_print text;
  v_name text;
  v_email text;
  v_phone text;
  v_cep text;
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
  v_cep := regexp_replace(coalesce(p_customer->>'cep', ''), '\D', '', 'g');

  IF length(v_name) < 3 OR position(' ' IN v_name) = 0 THEN
    RAISE EXCEPTION 'Informe o nome completo.';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Informe um telefone válido.';
  END IF;
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

  INSERT INTO orders (
    customer_name, customer_email, customer_phone,
    delivery_cep, delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_city, delivery_state
  ) VALUES (
    v_name, v_email, v_phone,
    v_cep,
    left(trim(p_customer->>'street'), 160),
    left(trim(p_customer->>'number'), 20),
    left(trim(coalesce(p_customer->>'complement', '')), 120),
    left(trim(p_customer->>'neighborhood'), 120),
    left(trim(p_customer->>'city'), 120),
    upper(left(trim(p_customer->>'state'), 2))
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
  SET subtotal_cents = v_subtotal, total_cents = v_subtotal, updated_at = now()
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_number,
    'access_token', v_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order(jsonb, jsonb) TO anon, authenticated;

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

INSERT INTO print_formats (code, label, kind, width_cm, height_cm, price_cents, sort_order) VALUES
  ('10x15', '10 x 15 cm', 'tradicional', 10, 15, 190, 1),
  ('13x18', '13 x 18 cm', 'tradicional', 13, 18, 350, 2),
  ('15x21', '15 x 21 cm', 'tradicional', 15, 21, 490, 3),
  ('20x25', '20 x 25 cm', 'tradicional', 20, 25, 1290, 4),
  ('20x30', '20 x 30 cm', 'tradicional', 20, 30, 1690, 5),
  ('quadrada-10', 'Quadrada 10 x 10 cm', 'quadrada', 10, 10, 290, 6),
  ('polaroid-9x11', 'Polaroid clássica 9 x 11 cm', 'polaroid', 9, 11, 690, 7)
ON CONFLICT (code) DO NOTHING;
