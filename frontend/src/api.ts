// ─── Типы данных API ─────────────────────────────────────────────────────────
export interface Product {
  id: number;
  name: string;
  price: number | string;
  cost: number | string;
  stock: number;
  category: string;
  archived: boolean;
}

export interface SaleItem {
  id: number;
  quantity: number;
  deliveredQty: number;
  price: number | string;
  notes?: string | null;
  product: Product;
}

export type PaymentMethod = 'cash' | 'card';

export interface Sale {
  id: number;
  number: number;
  total: number | string;
  paymentMethod: PaymentMethod;
  cashReceived?: number | string | null;
  closed: boolean;
  createdAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  closedAt?: string | null;
  items: SaleItem[];
  user?: { id: number; email: string; name?: string | null };
}

export interface User {
  id: number;
  email: string;
  name?: string | null;
  role: 'admin' | 'cashier';
}

export interface BoardEntry {
  id: number;
  number: number;
  readyAt: string | null;
  startedAt: string | null;
  createdAt: string;
}

export interface NewSaleItem {
  productId: number;
  quantity: number;
  price: number;
  notes?: string;
}

// ─── Транспорт ───────────────────────────────────────────────────────────────
import { isDemoError, mockRequest } from './demo/mockApi';

/** Сборка для GitHub Pages: API эмулируется в браузере */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
export const getToken = () => localStorage.getItem('token');

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getStoredUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

// Истёкший токен — выкидываем на экран входа, а не показываем непонятную ошибку
export const UNAUTHORIZED_EVENT = 'pos:unauthorized';

const BASE = '/api';

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (IS_DEMO) {
    try {
      return await mockRequest(path, options, token);
    } catch (e) {
      if (isDemoError(e) && e.status === 401 && token && !path.startsWith('/auth/login')) {
        clearSession();
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
      throw e;
    }
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Сервер недоступен. Проверьте, что бэкенд запущен');
  }
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    clearSession();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.status >= 500 ? 'Сервер недоступен' : res.statusText }));
    throw new Error(err.error || 'Ошибка сети');
  }
  return res.json();
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

type ProductInput = { name: string; price: number; cost: number; stock: number; category: string };

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', json('POST', { email, password })),
  me: () => request<User>('/auth/me'),
  getUsers: () => request<User[]>('/auth/users'),
  register: (data: { email: string; password: string; name?: string; role: User['role'] }) =>
    request<User>('/auth/register', json('POST', data)),

  // Products
  getProducts: (all = false) => request<Product[]>(`/inventory/products${all ? '?all=1' : ''}`),
  createProduct: (data: ProductInput) => request<Product>('/inventory/products', json('POST', data)),
  updateProduct: (id: number, data: Partial<ProductInput & { archived: boolean }>) =>
    request<Product>(`/inventory/products/${id}`, json('PUT', data)),
  adjustStock: (id: number, delta: number) =>
    request<Product>(`/inventory/products/${id}/adjust`, json('POST', { delta })),
  deleteProduct: (id: number) =>
    request<{ ok: boolean; archived: boolean }>(`/inventory/products/${id}`, json('DELETE')),

  // Sales
  getSales: (from?: Date, to?: Date) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from.toISOString());
    if (to) q.set('to', to.toISOString());
    const s = q.toString();
    return request<Sale[]>(`/sales${s ? `?${s}` : ''}`);
  },
  createSale: (items: NewSaleItem[], paymentMethod: PaymentMethod, cashReceived?: number) =>
    request<Sale>('/sales', json('POST', { items, paymentMethod, cashReceived })),

  // Queue / kitchen
  getQueue: () => request<Sale[]>('/sales/queue'),
  getBoard: () => request<{ preparing: BoardEntry[]; ready: BoardEntry[] }>('/sales/board'),
  startSale: (saleId: number) => request<Sale>(`/sales/${saleId}/start`, json('PUT')),
  deliverItem: (saleId: number, itemId: number) =>
    request<Sale>(`/sales/${saleId}/items/${itemId}/deliver`, json('PUT')),
  undeliverItem: (saleId: number, itemId: number) =>
    request<Sale>(`/sales/${saleId}/items/${itemId}/undeliver`, json('PUT')),
  markReady: (saleId: number) => request<Sale>(`/sales/${saleId}/ready`, json('PUT')),
  closeSale: (saleId: number) => request<Sale>(`/sales/${saleId}/close`, json('PUT')),
};
