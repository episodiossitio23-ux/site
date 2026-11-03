/*
# Mercado Pago payment settings (write-only secret)

Plain-English summary: adds a payment configuration area used by the admin panel. The Mercado Pago access token is stored in a table that no browser role can read. The admin can only save it and see whether it is configured. Checkout and the payment confirmation webhook run on the server and read the token from there.

1. New Tables
- `payment_settings`: single row holding whether Mercado Pago is enabled, the access token, and when it was last changed.

2. Modified Tables
- `orders`: new column `mp_payment_id` that stores the Mercado Pago payment number once it is approved.

3. Functions
- `admin_get_payment_settings()`: returns whether payments are enabled and whether a token is saved. Never returns the token. Admins only.
- `admin_save_payment_settings(p_enabled, p_access_token)`: saves the switch and, when provided, a new token. Admins only.
- `mercadopago_enabled()`: returns true only when payments are enabled and a token is saved. Visitors may call it.

4. Security
- RLS enabled on `payment_settings` with no policies, and every browser role is revoked. Only the server role can read or write the table.
- The server role receives read and update access to `orders` and `order_items` so the payment functions can confirm orders.
- The admin functions check `is_admin()` before doing anything.

# Important notes
1. The token is validated for the expected Mercado Pago format before it is saved.
2. Enabling payments requires a saved token.
*/

CREATE TABLE IF NOT EXISTS payment_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mp_enabled boolean NOT NULL DEFAULT false,
  mp_access_token text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON payment_settings TO service_role;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id text NOT NULL DEFAULT '';
GRANT SELECT, UPDATE (status, mp_payment_id, updated_at) ON orders TO service_role;
GRANT SELECT ON order_items TO service_role;

CREATE OR REPLACE FUNCTION admin_get_payment_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN (
    SELECT jsonb_build_object('mp_enabled', mp_enabled, 'has_token', mp_access_token <> '')
    FROM payment_settings
    WHERE id = 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_get_payment_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_get_payment_settings() TO authenticated;

CREATE OR REPLACE FUNCTION admin_save_payment_settings(p_enabled boolean, p_access_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := nullif(trim(coalesce(p_access_token, '')), '');
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF v_token IS NOT NULL AND v_token !~ '^(APP_USR|TEST)-[A-Za-z0-9-]{20,200}$' THEN
    RAISE EXCEPTION 'O Access Token informado não parece válido.';
  END IF;
  IF p_enabled AND v_token IS NULL AND NOT EXISTS (
    SELECT 1 FROM payment_settings WHERE id = 1 AND mp_access_token <> ''
  ) THEN
    RAISE EXCEPTION 'Informe o Access Token para ativar o pagamento.';
  END IF;

  UPDATE payment_settings
  SET mp_enabled = p_enabled,
      mp_access_token = coalesce(v_token, mp_access_token),
      updated_at = now()
  WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_save_payment_settings(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_payment_settings(boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION mercadopago_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payment_settings
    WHERE id = 1 AND mp_enabled AND mp_access_token <> ''
  );
$$;

REVOKE EXECUTE ON FUNCTION mercadopago_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mercadopago_enabled() TO anon, authenticated;
