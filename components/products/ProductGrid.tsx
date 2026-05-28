import type { Product } from '@/types/product';
import { ProductCard } from './ProductCard';

type ProductGridProps = {
  products: Product[];
  locale: string;
  isAuthenticated?: boolean;
  wishlistIds?: Set<string>;
};

export function ProductGrid({
  products,
  locale,
  isAuthenticated = false,
  wishlistIds
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          isAuthenticated={isAuthenticated}
          inWishlist={wishlistIds?.has(product.id) ?? false}
        />
      ))}
    </div>
  );
}
