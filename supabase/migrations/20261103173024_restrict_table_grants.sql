REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON print_formats TO anon, authenticated;
GRANT UPDATE (label, price_cents, is_active) ON print_formats TO authenticated;

GRANT SELECT ON shipping_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON shipping_methods TO authenticated;

GRANT SELECT ON store_settings TO anon, authenticated;
GRANT UPDATE ON store_settings TO authenticated;

GRANT SELECT (id, is_active, host, port, secure, username, from_name, from_email) ON smtp_settings TO authenticated;
GRANT UPDATE ON smtp_settings TO authenticated;

GRANT SELECT ON orders TO authenticated;
GRANT UPDATE (status, updated_at) ON orders TO authenticated;

GRANT SELECT ON order_items TO authenticated;

GRANT SELECT ON admin_users TO authenticated;
