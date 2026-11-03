/*
# Restrict catalog write privileges

1. Modified Tables
- `catalog_categories`: anonymous users keep read access only.
- `catalog_products`: anonymous users keep read access only.
- `catalog_variants`: anonymous users keep read access only.
- `catalog_quantity_discounts`: anonymous users keep read access only.

2. Security
- Removes INSERT, UPDATE and DELETE privileges from the `anon` role on catalog tables.
- Keeps administrator writes protected by the existing `is_admin()` policies.
- This is an explicit privilege restriction because database-level grants are checked before row-level policies.

3. Important Notes
- Customers can still browse active catalog records.
- Only authenticated administrators can manage catalog data.
*/

REVOKE INSERT, UPDATE, DELETE ON catalog_categories, catalog_products, catalog_variants, catalog_quantity_discounts FROM anon;
GRANT SELECT ON catalog_categories, catalog_products, catalog_variants, catalog_quantity_discounts TO anon;
