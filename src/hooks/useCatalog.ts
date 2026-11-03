import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CatalogCategory, CatalogProduct, CatalogProductWithVariants, CatalogVariant } from '@/types/catalog';

export function useCatalog(includeInactive = false) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const categoryQuery = supabase.from('catalog_categories').select('*').order('sort_order');
      const productQuery = supabase.from('catalog_products').select('*').order('sort_order');
      const variantQuery = supabase.from('catalog_variants').select('*').order('sort_order');
      const [categoryResult, productResult, variantResult] = await Promise.all([
        includeInactive ? categoryQuery : categoryQuery.eq('is_active', true),
        includeInactive ? productQuery : productQuery.eq('is_active', true),
        includeInactive ? variantQuery : variantQuery.eq('is_active', true),
      ]);
      if (!active) return;
      if (categoryResult.error || productResult.error || variantResult.error) {
        setError('Não foi possível carregar o catálogo.');
      } else {
        const categoryRows = (categoryResult.data as CatalogCategory[]) ?? [];
        const productRows = (productResult.data as CatalogProduct[]) ?? [];
        const variantRows = (variantResult.data as CatalogVariant[]) ?? [];
        setCategories(categoryRows);
        setProducts(
          productRows.map((product) => ({
            ...product,
            variants: variantRows.filter((variant) => variant.product_id === product.id),
          })),
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [includeInactive]);

  return { categories, products, loading, error };
}
