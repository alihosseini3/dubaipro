'use client';

import { useEffect, useState } from 'react';

const KEY = 'rv_products';
const MAX = 12;

export type RecentlyViewedEntry = {
  slug: string;
  title: string;
  imageUrl?: string | null;
  price: number;
  currency: string;
};

function read(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentlyViewedEntry[];
  } catch {
    return [];
  }
}

function write(items: RecentlyViewedEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // storage full or unavailable
  }
}

/** Record the current product into recently-viewed list. */
export function recordView(entry: RecentlyViewedEntry): void {
  const items = read().filter((i) => i.slug !== entry.slug);
  write([entry, ...items]);
}

/** React hook — returns the stored recently-viewed list (excluding current slug). */
export function useRecentlyViewed(currentSlug?: string): RecentlyViewedEntry[] {
  const [items, setItems] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    const all = read();
    setItems(currentSlug ? all.filter((i) => i.slug !== currentSlug) : all);
  }, [currentSlug]);

  return items;
}
