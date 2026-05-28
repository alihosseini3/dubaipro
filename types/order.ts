export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderItemDTO = {
  id: string;
  productId: string;
  quantity: number;
  price: string | number;
  product?: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
  } | null;
};

export type OrderDTO = {
  id: string;
  status: OrderStatus;
  totalPrice: string | number;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: OrderItemDTO[];
};
