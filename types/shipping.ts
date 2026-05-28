export type ShippingMethodDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDays: number;
  isActive: boolean;
  sortOrder: number;
  zoneId: string | null;
  // Rule-engine fields (nullable → fallback to flat `price`).
  minWeight: number | null;
  maxWeight: number | null;
  basePrice: number | null;
  pricePerKg: number | null;
  volumetricFactor: number | null;
  shippingClass: string | null;
};

export type ShippingMethodInput = {
  name: string;
  description?: string | null;
  price: number;
  estimatedDays: number;
  isActive?: boolean;
  sortOrder?: number;
  zoneId?: string | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  basePrice?: number | null;
  pricePerKg?: number | null;
  volumetricFactor?: number | null;
  shippingClass?: string | null;
};

export type ShippingSettingsDTO = {
  defaultVolumetricFactor: number;
  enableVolumetric: boolean;
  roundingStrategy: 'ceil' | 'round';
};

// Per-item shape consumed by the calculator.
export type ShippingItemInput = {
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  shippingClass?: string | null;
  quantity: number;
};

export type ShippingQuoteBreakdown = {
  methodId: string;
  methodName: string;
  estimatedDays: number;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  basePrice: number;
  weightCost: number;
  total: number;
  rounding: 'ceil' | 'round';
  fallback: 'specific' | 'class' | 'global' | 'flat';
};

export type ShippingZoneDTO = {
  id: string;
  name: string;
  countries: string[];
  isActive: boolean;
  sortOrder: number;
};

export type ShippingZoneInput = {
  name: string;
  countries: string[];
  isActive?: boolean;
  sortOrder?: number;
};
