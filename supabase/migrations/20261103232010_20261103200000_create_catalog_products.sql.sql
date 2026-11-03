/*
# Create the store catalog

1. New Tables
- `catalog_categories`: public product categories with names, descriptions, ordering and visibility.
- `catalog_products`: products shown in the store, including traditional photos, Polaroids, kits and custom products.
- `catalog_variants`: sellable product options with finish, format, price, minimum quantity, production time and availability.
- `catalog_quantity_discounts`: optional percentage discounts that apply from a minimum quantity for a catalog variant.

2. Security
- Row level security is enabled on every catalog table.
- Visitors can read only active categories, products, variants and discounts.
- Authenticated administrators can read and manage all catalog records.
- Customers cannot create, edit or remove catalog data.

3. Important Notes
- Existing `print_formats` and historical order prices are preserved.
- Catalog variants may reference an existing print format so the editor can be connected in a later step.
- Prices are stored in cents and are validated as non-negative values.
*/

CREATE TABLE IF NOT EXISTS catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 240),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES catalog_categories(id),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  product_type text NOT NULL CHECK (product_type IN ('foto', 'polaroid', 'kit', 'personalizado')),
  image_url text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  format_id uuid REFERENCES print_formats(id),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  finish_name text NOT NULL DEFAULT 'Padrão' CHECK (char_length(trim(finish_name)) BETWEEN 2 AND 80),
  finish_description text NOT NULL DEFAULT '' CHECK (char_length(finish_description) <= 240),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity BETWEEN 1 AND 1000),
  production_days integer NOT NULL DEFAULT 3 CHECK (production_days BETWEEN 0 AND 90),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_quantity_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES catalog_variants(id) ON DELETE CASCADE,
  minimum_quantity integer NOT NULL CHECK (minimum_quantity BETWEEN 2 AND 10000),
  percent_off numeric(5,2) NOT NULL CHECK (percent_off > 0 AND percent_off < 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, minimum_quantity)
);

CREATE INDEX IF NOT EXISTS catalog_products_category_idx ON catalog_products(category_id);
CREATE INDEX IF NOT EXISTS catalog_variants_product_idx ON catalog_variants(product_id);
CREATE INDEX IF NOT EXISTS catalog_variants_format_idx ON catalog_variants(format_id);
CREATE INDEX IF NOT EXISTS catalog_discounts_variant_idx ON catalog_quantity_discounts(variant_id);

ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_quantity_discounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON catalog_categories, catalog_products, catalog_variants, catalog_quantity_discounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON catalog_categories, catalog_products, catalog_variants, catalog_quantity_discounts TO authenticated;

DROP POLICY IF EXISTS "public_reads_active_catalog_categories" ON catalog_categories;
CREATE POLICY "public_reads_active_catalog_categories" ON catalog_categories FOR SELECT
TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admins_read_all_catalog_categories" ON catalog_categories;
CREATE POLICY "admins_read_all_catalog_categories" ON catalog_categories FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_catalog_categories" ON catalog_categories;
CREATE POLICY "admins_insert_catalog_categories" ON catalog_categories FOR INSERT
TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_update_catalog_categories" ON catalog_categories;
CREATE POLICY "admins_update_catalog_categories" ON catalog_categories FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_delete_catalog_categories" ON catalog_categories;
CREATE POLICY "admins_delete_catalog_categories" ON catalog_categories FOR DELETE
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "public_reads_active_catalog_products" ON catalog_products;
CREATE POLICY "public_reads_active_catalog_products" ON catalog_products FOR SELECT
TO anon, authenticated USING (
  is_active AND EXISTS (
    SELECT 1 FROM catalog_categories c WHERE c.id = category_id AND c.is_active
  )
);

DROP POLICY IF EXISTS "admins_read_all_catalog_products" ON catalog_products;
CREATE POLICY "admins_read_all_catalog_products" ON catalog_products FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_catalog_products" ON catalog_products;
CREATE POLICY "admins_insert_catalog_products" ON catalog_products FOR INSERT
TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_update_catalog_products" ON catalog_products;
CREATE POLICY "admins_update_catalog_products" ON catalog_products FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_delete_catalog_products" ON catalog_products;
CREATE POLICY "admins_delete_catalog_products" ON catalog_products FOR DELETE
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "public_reads_active_catalog_variants" ON catalog_variants;
CREATE POLICY "public_reads_active_catalog_variants" ON catalog_variants FOR SELECT
TO anon, authenticated USING (
  is_active AND EXISTS (
    SELECT 1 FROM catalog_products p
    JOIN catalog_categories c ON c.id = p.category_id
    WHERE p.id = product_id AND p.is_active AND c.is_active
  )
);

DROP POLICY IF EXISTS "admins_read_all_catalog_variants" ON catalog_variants;
CREATE POLICY "admins_read_all_catalog_variants" ON catalog_variants FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_catalog_variants" ON catalog_variants;
CREATE POLICY "admins_insert_catalog_variants" ON catalog_variants FOR INSERT
TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_update_catalog_variants" ON catalog_variants;
CREATE POLICY "admins_update_catalog_variants" ON catalog_variants FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_delete_catalog_variants" ON catalog_variants;
CREATE POLICY "admins_delete_catalog_variants" ON catalog_variants FOR DELETE
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "public_reads_active_catalog_discounts" ON catalog_quantity_discounts;
CREATE POLICY "public_reads_active_catalog_discounts" ON catalog_quantity_discounts FOR SELECT
TO anon, authenticated USING (
  EXISTS (
    SELECT 1 FROM catalog_variants v
    JOIN catalog_products p ON p.id = v.product_id
    JOIN catalog_categories c ON c.id = p.category_id
    WHERE v.id = variant_id AND v.is_active AND p.is_active AND c.is_active
  )
);

DROP POLICY IF EXISTS "admins_read_all_catalog_discounts" ON catalog_quantity_discounts;
CREATE POLICY "admins_read_all_catalog_discounts" ON catalog_quantity_discounts FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_catalog_discounts" ON catalog_quantity_discounts;
CREATE POLICY "admins_insert_catalog_discounts" ON catalog_quantity_discounts FOR INSERT
TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_update_catalog_discounts" ON catalog_quantity_discounts;
CREATE POLICY "admins_update_catalog_discounts" ON catalog_quantity_discounts FOR UPDATE
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_delete_catalog_discounts" ON catalog_quantity_discounts;
CREATE POLICY "admins_delete_catalog_discounts" ON catalog_quantity_discounts FOR DELETE
TO authenticated USING (is_admin());

INSERT INTO catalog_categories (slug, name, description, sort_order)
VALUES
  ('fotos-tradicionais', 'Fotos tradicionais', 'Impressões clássicas para guardar seus melhores momentos.', 1),
  ('fotos-polaroid', 'Fotos Polaroid', 'Molduras com espaço para mensagens e dedicatórias.', 2),
  ('kits-de-fotos', 'Kits de fotografias', 'Combinações especiais para imprimir mais e economizar.', 3),
  ('personalizados', 'Produtos personalizados', 'Produtos afetivos criados com suas próprias fotografias.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catalog_products (category_id, slug, name, description, product_type, is_featured, sort_order)
SELECT c.id, v.slug, v.name, v.description, v.product_type, v.is_featured, v.sort_order
FROM (
  VALUES
    ('fotos-tradicionais', 'revelacao-tradicional', 'Revelação tradicional', 'Fotos impressas em formatos clássicos, prontas para guardar ou presentear.', 'foto', true, 1),
    ('fotos-polaroid', 'polaroids-personalizadas', 'Polaroids personalizadas', 'Moldura delicada com legenda, data ou dedicatória criada por você.', 'polaroid', true, 2),
    ('kits-de-fotos', 'kit-memorias', 'Kit memórias', 'Uma seleção de impressões para montar seu álbum de lembranças.', 'kit', false, 3)
) AS v(category_slug, slug, name, description, product_type, is_featured, sort_order)
JOIN catalog_categories c ON c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catalog_variants (product_id, format_id, name, finish_name, finish_description, price_cents, min_quantity, production_days, sort_order)
SELECT p.id, f.id, f.label, 'Padrão', 'Impressão fotográfica com acabamento de qualidade.', f.price_cents, 1, 3, f.sort_order
FROM catalog_products p
JOIN print_formats f ON (
  (p.slug = 'revelacao-tradicional' AND f.kind = 'tradicional')
  OR (p.slug = 'polaroids-personalizadas' AND f.kind = 'polaroid')
)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_variants v WHERE v.product_id = p.id AND v.format_id = f.id
);

INSERT INTO catalog_variants (product_id, format_id, name, finish_name, finish_description, price_cents, min_quantity, production_days, sort_order)
SELECT p.id, NULL, 'Kit com 10 fotos', 'Padrão', 'Kit econômico com dez impressões selecionadas.', 1590, 1, 4, 1
FROM catalog_products p
WHERE p.slug = 'kit-memorias'
  AND NOT EXISTS (SELECT 1 FROM catalog_variants v WHERE v.product_id = p.id);
