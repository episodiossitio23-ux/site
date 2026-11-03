import type { CatalogQuantityDiscount, CatalogVariant } from '@/types/catalog';

export function getCatalogUnitPrice(variant: CatalogVariant & { discounts?: CatalogQuantityDiscount[] }, quantity: number): number {
  const percentOff = (variant.discounts ?? [])
    .filter((discount) => discount.minimum_quantity <= quantity)
    .reduce((highest, discount) => Math.max(highest, Number(discount.percent_off)), 0);
  return Math.round(variant.price_cents * (1 - percentOff / 100));
}
