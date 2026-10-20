import { useEffect, useState } from 'react';

export interface CartItem {
  cartId: string; // каждая штука — отдельная строка, кухня отмечает их по одной
  productId: number;
  name: string;
  category: string;
  finalPrice: number;
  notes?: string;
}

const KEY = 'pos:cart';

export const newCartId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function read(): CartItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Набранный, но не пробитый чек. Живёт на уровне приложения и в localStorage,
 * поэтому не теряется при переходе на «Кухню» и при обновлении страницы.
 */
export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(read);

  useEffect(() => {
    try {
      if (cart.length) localStorage.setItem(KEY, JSON.stringify(cart));
      else localStorage.removeItem(KEY);
    } catch {
      /* приватный режим — чек живёт до перезагрузки */
    }
  }, [cart]);

  return [cart, setCart] as const;
}

export const clearStoredCart = () => localStorage.removeItem(KEY);
