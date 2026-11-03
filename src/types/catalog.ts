export type CatalogProductType = 'foto' | 'polaroid' | 'kit' | 'personalizado';

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface CatalogProduct {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  product_type: CatalogProductType;
  image_url: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CatalogVariant {
  id: string;
  product_id: string;
  format_id: string | null;
  name: string;
  finish_name: string;
  finish_description: string;
  price_cents: number;
  min_quantity: number;
  production_days: number;
  is_active: boolean;
  sort_order: number;
}

export interface CatalogProductWithVariants extends CatalogProduct {
  variants: CatalogVariant[];
}
