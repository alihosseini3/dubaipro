export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
};

export type ProductBrand = {
  id: string;
  name: string;
  slug: string;
};

export type ProductSupplier = {
  id: string;
  userId?: string;
  name: string;
  country?: string;
  phone?: string | null;
  tier?: 'STANDARD' | 'VERIFIED' | 'GUARANTEED';
  ratingAvg?: number;
  ratingCount?: number;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  currency?: string;
  stock: number;
  isB2B?: boolean;
  moq?: number | null;
  imageUrl?: string | null;
  images?: string[] | null;
  category?: ProductCategory | null;
  brand?: ProductBrand | null;
  supplier?: ProductSupplier | null;
  // Shipping metadata (mirrors the Prisma `Product` model). All
  // optional because not every code path includes them.
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  shippingClass?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt?: string;
};

export type ProductsMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProductsResponse = {
  data: Product[];
  meta?: ProductsMeta;
};
