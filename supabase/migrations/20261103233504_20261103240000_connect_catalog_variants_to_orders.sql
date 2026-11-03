/*
# Connect catalog variants to secure order pricing

1. Modified tables
- `order_items.catalog_variant_id`: records the catalog variant selected for a photo when one is available. It is nullable so existing orders and the legacy print-format flow remain readable.

2. Pricing behavior
- `create_order` accepts an optional catalog variant identifier per item.
- When supplied, the database validates that the variant, product and category are active, that it matches the selected print format, and that the requested quantity meets the variant minimum.
- The database uses the variant price and applies the highest eligible quantity discount. Browser-sent prices remain ignored.
- Items without a catalog variant continue using the active `print_formats` price.

3. Security
- The new column is written only by the protected `create_order` function; customers do not receive direct write access to order items.
- Existing RLS and function grants remain in place.

4. Compatibility
- No existing data is deleted, renamed or retyped.
- Existing orders continue to work because the new relationship is optional.
*/

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS catalog_variant_id uuid REFERENCES catalog_variants(id);
CREATE INDEX IF NOT EXISTS order_items_catalog_variant_id_idx ON order_items(catalog_variant_id);

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
  v_variant catalog_variants%ROWTYPE;
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
  v_variant_id uuid;
  v_unit_price integer;
  v_discount numeric;
BEGIN
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN RAISE EXCEPTION 'Dados do cliente inválidos.'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'O pedido precisa de pelo menos uma foto.'; END IF;
  IF jsonb_array_length(p_items) > 200 THEN RAISE EXCEPTION 'O pedido aceita no máximo 200 itens.'; END IF;

  v_name := left(trim(coalesce(p_customer->>'name', '')), 120);
  v_email := left(trim(coalesce(p_customer->>'email', '')), 254);
  v_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_name) < 3 OR position(' ' IN v_name) = 0 THEN RAISE EXCEPTION 'Informe o nome completo.'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Informe um telefone válido.'; END IF;

  v_type := coalesce(p_fulfillment->>'type', '');
  IF v_type = 'retirada' THEN
    SELECT * INTO v_store FROM store_settings WHERE id = 1;
    v_pickup := coalesce(v_store.pickup_address, '');
    IF v_pickup = '' THEN RAISE EXCEPTION 'A retirada na loja não está disponível no momento.'; END IF;
  ELSIF v_type = 'envio' THEN
    v_cep := regexp_replace(coalesce(p_customer->>'cep', ''), '\D', '', 'g');
    IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'Informe um CEP válido.'; END IF;
    IF length(trim(coalesce(p_customer->>'street', ''))) < 2 OR length(trim(coalesce(p_customer->>'number', ''))) < 1 OR length(trim(coalesce(p_customer->>'neighborhood', ''))) < 2 OR length(trim(coalesce(p_customer->>'city', ''))) < 2 OR length(trim(coalesce(p_customer->>'state', ''))) <> 2 THEN RAISE EXCEPTION 'Preencha o endereço de entrega completo.'; END IF;
    v_street := left(trim(p_customer->>'street'), 160);
    v_house_number := left(trim(p_customer->>'number'), 20);
    v_complement := left(trim(coalesce(p_customer->>'complement', '')), 120);
    v_neighborhood := left(trim(p_customer->>'neighborhood'), 120);
    v_city := left(trim(p_customer->>'city'), 120);
    v_state := upper(left(trim(p_customer->>'state'), 2));
    SELECT * INTO v_ship FROM shipping_methods WHERE id = (p_fulfillment->>'shipping_method_id')::uuid AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'A forma de envio escolhida não está disponível.'; END IF;
    v_shipping := v_ship.price_cents;
    v_ship_name := v_ship.name;
  ELSE
    RAISE EXCEPTION 'Escolha como deseja receber o pedido.';
  END IF;

  INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_cep, delivery_street, delivery_number, delivery_complement, delivery_neighborhood, delivery_city, delivery_state, fulfillment_type, shipping_method_name, shipping_cents, pickup_address)
  VALUES (v_name, v_email, v_phone, v_cep, v_street, v_house_number, v_complement, v_neighborhood, v_city, v_state, v_type, v_ship_name, v_shipping, v_pickup)
  RETURNING id, order_number, access_token INTO v_order_id, v_number, v_token;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_pos := v_pos + 1;
    SELECT * INTO v_format FROM print_formats WHERE id = (v_item->>'format_id')::uuid AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Um dos formatos escolhidos não está disponível.'; END IF;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    IF v_qty < 1 OR v_qty > 100 THEN RAISE EXCEPTION 'A quantidade de cada foto deve estar entre 1 e 100.'; END IF;

    v_variant_id := NULLIF(v_item->>'catalog_variant_id', '')::uuid;
    v_unit_price := v_format.price_cents;
    v_discount := 0;
    IF v_variant_id IS NOT NULL THEN
      SELECT v.* INTO v_variant
      FROM catalog_variants v
      JOIN catalog_products p ON p.id = v.product_id
      JOIN catalog_categories c ON c.id = p.category_id
      WHERE v.id = v_variant_id AND v.is_active AND p.is_active AND c.is_active AND v.format_id = v_format.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'A opção de produto escolhida não está disponível.'; END IF;
      IF v_qty < v_variant.min_quantity THEN RAISE EXCEPTION 'A quantidade mínima para esta opção é %.', v_variant.min_quantity; END IF;
      v_unit_price := v_variant.price_cents;
      SELECT coalesce(max(d.percent_off), 0) INTO v_discount FROM catalog_quantity_discounts d WHERE d.variant_id = v_variant.id AND d.minimum_quantity <= v_qty;
      v_unit_price := round(v_unit_price * (1 - v_discount / 100));
    END IF;

    v_original := v_item->>'original_path';
    v_print := v_item->>'print_path';
    IF v_original IS NULL OR v_original !~ '^sessions/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$' OR v_print IS NULL OR v_print !~ '^sessions/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$' THEN RAISE EXCEPTION 'Arquivo de foto inválido.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'print-files' AND name = v_original) OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'print-files' AND name = v_print) THEN RAISE EXCEPTION 'Algumas fotos não foram enviadas. Tente novamente.'; END IF;

    v_subtotal := v_subtotal + v_unit_price * v_qty;
    INSERT INTO order_items (order_id, position, format_id, catalog_variant_id, format_label, format_kind, unit_price_cents, quantity, line_total_cents, caption, caption_style, crop_settings, original_name, original_path, print_path)
    VALUES (v_order_id, v_pos, v_format.id, v_variant_id, coalesce(v_variant.name, v_format.label), v_format.kind, v_unit_price, v_qty, v_unit_price * v_qty, left(coalesce(v_item->>'caption', ''), 200), CASE WHEN jsonb_typeof(v_item->'caption_style') = 'object' THEN v_item->'caption_style' ELSE '{}'::jsonb END, CASE WHEN jsonb_typeof(v_item->'crop_settings') = 'object' THEN v_item->'crop_settings' ELSE '{}'::jsonb END, left(coalesce(v_item->>'original_name', 'foto'), 255), v_original, v_print);
  END LOOP;

  UPDATE orders SET subtotal_cents = v_subtotal, total_cents = v_subtotal + v_shipping, updated_at = now() WHERE id = v_order_id;
  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'access_token', v_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order(jsonb, jsonb, jsonb) TO anon, authenticated;