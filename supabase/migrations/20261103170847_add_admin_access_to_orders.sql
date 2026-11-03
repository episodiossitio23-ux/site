/*
# Admin access to orders, order items and print files

Plain-English summary: lets signed-in store administrators read orders, change order status and download customer photos. Everyone else is still blocked. Administrators are listed in a private table that only the database and the server can edit.

1. New Tables
- `admin_users`: one row per administrator, linked to a sign-in account. Each signed-in user can read only their own row, so the app can tell whether they are an administrator.

2. New Functions
- `is_admin()`: returns true when the current signed-in user is listed in `admin_users`. Callable only by signed-in users.

3. Modified Access
- `orders`: administrators can read every order and change only the `status` and `updated_at` columns.
- `order_items`: administrators can read every item.
- Storage bucket `print-files`: administrators can read (and therefore download) the stored photos. Nobody else can read them.

4. Security
- RLS enabled on `admin_users`.
- Policies check `is_admin()` so access depends on the server-side admin list, never on user-editable data.
- Visitors keep no access to orders, items or files.

# Important notes
1. To make someone an administrator, insert their account id into `admin_users` from the database (not from the website).
2. Status changes are limited to the status and update timestamp columns.
*/

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON admin_users TO authenticated;

DROP POLICY IF EXISTS "admins_read_own_row" ON admin_users;
CREATE POLICY "admins_read_own_row" ON admin_users FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

GRANT SELECT ON orders TO authenticated;
GRANT UPDATE (status, updated_at) ON orders TO authenticated;

DROP POLICY IF EXISTS "admins_read_orders" ON orders;
CREATE POLICY "admins_read_orders" ON orders FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_update_order_status" ON orders;
CREATE POLICY "admins_update_order_status" ON orders FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON order_items TO authenticated;

DROP POLICY IF EXISTS "admins_read_order_items" ON order_items;
CREATE POLICY "admins_read_order_items" ON order_items FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_read_print_files" ON storage.objects;
CREATE POLICY "admins_read_print_files" ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'print-files' AND is_admin());
