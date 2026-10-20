/**
 * Демо-режим без сервера (сборка с VITE_DEMO=1, для GitHub Pages).
 * Повторяет поведение бэкенда (backend/src/routes) поверх localStorage.
 * Данные живут только в этом браузере; «Сбросить демо» возвращает исходное состояние.
 */
import type { Product, Sale, SaleItem, User } from '../api';

const KEY = 'pos-demo:db';

interface DemoUser extends User {
  password: string;
}

interface Db {
  seq: number;
  users: DemoUser[];
  products: Product[];
  sales: Sale[];
}

export const DEMO_ACCOUNTS = [
  { email: 'admin@demo.ru', password: 'demo123', label: 'Администратор' },
  { email: 'kassa@demo.ru', password: 'demo123', label: 'Кассир' },
];

class DemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MENU: [string, number, number, number, string][] = [
  ['Шаурма классическая', 450, 180, 100, 'Шаурма'],
  ['Шаурма с сыром', 520, 210, 80, 'Шаурма'],
  ['Шаурма двойная', 650, 280, 60, 'Шаурма'],
  ['Шаурма в лаваше', 400, 160, 90, 'Шаурма'],
  ['Шаурма куриная', 480, 190, 70, 'Шаурма'],
  ['Картофель фри', 200, 60, 80, 'Снэки'],
  ['Наггетсы (6 шт)', 280, 100, 60, 'Снэки'],
  ['Чай чёрный', 100, 20, 200, 'Напитки'],
  ['Чай зелёный', 100, 20, 200, 'Напитки'],
  ['Кофе американо', 180, 40, 150, 'Напитки'],
  ['Кофе капучино', 220, 60, 150, 'Напитки'],
  ['Кофе латте', 250, 70, 150, 'Напитки'],
  ['Айран', 120, 30, 100, 'Напитки'],
  ['Coca-Cola 0.5л', 150, 60, 100, 'Напитки'],
  ['Соус чесночный', 50, 10, 300, 'Соусы'],
  ['Соус острый', 50, 10, 300, 'Соусы'],
  ['Соус ткемали', 50, 10, 6, 'Соусы'],
];

// Детерминированный генератор — у всех одинаковая демо-история
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function seed(): Db {
  const db: Db = { seq: 1000, users: [], products: [], sales: [] };
  const id = () => ++db.seq;
  db.users = [
    { id: id(), email: 'admin@demo.ru', name: 'Администратор', role: 'admin', password: 'demo123' },
    { id: id(), email: 'kassa@demo.ru', name: 'Мадина', role: 'cashier', password: 'demo123' },
  ];
  db.products = MENU.map(([name, price, cost, stock, category]) => ({ id: id(), name, price, cost, stock, category, archived: false }));

  // История продаж за 7 дней: больше в обед и вечером
  const rand = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const shawarma = db.products.filter(p => p.category === 'Шаурма');
  const others = db.products.filter(p => p.category !== 'Шаурма' && p.category !== 'Соусы');
  const hours = [10, 11, 12, 12, 13, 13, 13, 14, 14, 15, 17, 18, 18, 19, 19, 19, 20, 20, 21, 22];
  const now = new Date();

  for (let d = 6; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    // Сегодня — только часы, которые уже прошли
    const dayHours = d === 0 ? hours.filter(h => h < now.getHours()) : hours;
    const count = dayHours.length ? (d === 0 ? Math.round((dayHours.length / hours.length) * 25) : 18 + Math.floor(rand() * 14)) : 0;
    const times = Array.from({ length: count }, () => {
      const t = new Date(day);
      t.setHours(pick(dayHours), Math.floor(rand() * 60), Math.floor(rand() * 60));
      return t;
    }).sort((a, b) => +a - +b);

    times.forEach((created, n) => {
      const lines: Product[] = [pick(shawarma)];
      if (rand() < 0.45) lines.push(pick(shawarma));
      if (rand() < 0.7) lines.push(pick(others));
      const cook = 180 + Math.floor(rand() * 420);
      const items: SaleItem[] = lines.map(p => {
        const cheese = p.category === 'Шаурма' && rand() < 0.3;
        return {
          id: id(),
          quantity: 1,
          deliveredQty: 1,
          price: Number(p.price) + (cheese ? 60 : 0),
          notes: cheese ? '+ Двойной сыр' : null,
          product: p,
        };
      });
      const total = items.reduce((s, i) => s + Number(i.price), 0);
      const card = rand() < 0.6;
      db.sales.push({
        id: id(),
        number: n + 1,
        total,
        paymentMethod: card ? 'card' : 'cash',
        cashReceived: card ? null : Math.ceil(total / 500) * 500,
        closed: true,
        createdAt: created.toISOString(),
        startedAt: new Date(+created + 40_000).toISOString(),
        readyAt: new Date(+created + 40_000 + cook * 1000).toISOString(),
        closedAt: new Date(+created + 60_000 + cook * 1000).toISOString(),
        items,
        user: { id: db.users[1].id, email: db.users[1].email, name: db.users[1].name },
      });
    });
  }
  return db;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* повреждённые данные — пересоздаём */
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* приватный режим — демо работает до перезагрузки */
  }
}

export function resetDemo() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('pos:cart');
  location.reload();
}

const publicUser = (u: DemoUser): User => ({ id: u.id, email: u.email, name: u.name, role: u.role });

// «Токен» демо — просто id пользователя
function currentUser(db: Db, token: string | null) {
  const u = db.users.find(x => `demo-${x.id}` === token);
  if (!u) throw new DemoError(401, 'Требуется вход');
  return u;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function syncReady(sale: Sale) {
  const allDone = sale.items.every(i => i.deliveredQty >= i.quantity);
  if (allDone && !sale.readyAt) {
    sale.readyAt = new Date().toISOString();
    sale.startedAt ||= sale.readyAt;
  }
  if (!allDone && sale.readyAt) sale.readyAt = null;
}

export async function mockRequest(path: string, options: RequestInit, token: string | null): Promise<any> {
  await new Promise(r => setTimeout(r, 120)); // как будто сеть
  const db = load();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const [route, query = ''] = path.split('?');
  const q = new URLSearchParams(query);
  const seg = route.split('/').filter(Boolean); // ['sales', '12', 'start']

  const done = <T,>(v: T) => {
    save(db);
    return JSON.parse(JSON.stringify(v)) as T;
  };

  // ─── Auth ───
  if (route === '/auth/login') {
    const u = db.users.find(x => x.email === String(body.email || '').trim().toLowerCase());
    if (!u || u.password !== body.password) throw new DemoError(401, 'Неверный email или пароль');
    return { token: `demo-${u.id}`, user: publicUser(u) };
  }

  const me = currentUser(db, token);
  const admin = () => {
    if (me.role !== 'admin') throw new DemoError(403, 'Недостаточно прав');
  };

  if (route === '/auth/me') return publicUser(me);
  if (route === '/auth/users') {
    admin();
    return db.users.map(publicUser);
  }
  if (route === '/auth/register') {
    admin();
    const email = String(body.email || '').trim().toLowerCase();
    if (db.users.some(u => u.email === email)) throw new DemoError(400, 'Пользователь с таким email уже есть');
    if (String(body.password || '').length < 6) throw new DemoError(400, 'Пароль — не короче 6 символов');
    const u: DemoUser = { id: ++db.seq, email, name: body.name || null, role: body.role === 'admin' ? 'admin' : 'cashier', password: body.password };
    db.users.push(u);
    return done(publicUser(u));
  }

  // ─── Товары ───
  if (seg[0] === 'inventory') {
    const id = Number(seg[2]);
    const p = db.products.find(x => x.id === id);
    if (method === 'GET') {
      const list = q.get('all') ? db.products : db.products.filter(x => !x.archived);
      return done(list);
    }
    admin();
    if (method === 'POST' && !seg[2]) {
      const np: Product = { id: ++db.seq, name: body.name, price: +body.price, cost: +body.cost, stock: +body.stock, category: body.category, archived: false };
      db.products.push(np);
      return done(np);
    }
    if (!p) throw new DemoError(404, 'Товар не найден');
    if (seg[3] === 'adjust') {
      p.stock += Math.trunc(+body.delta);
      return done(p);
    }
    if (method === 'PUT') {
      Object.assign(p, body);
      return done(p);
    }
    if (method === 'DELETE') {
      const used = db.sales.some(s => s.items.some(i => i.product.id === id));
      if (used) p.archived = true;
      else db.products = db.products.filter(x => x.id !== id);
      return done({ ok: true, archived: used });
    }
  }

  // ─── Продажи ───
  if (seg[0] === 'sales') {
    if (method === 'GET' && !seg[1]) {
      const from = q.get('from') ? new Date(q.get('from')!) : null;
      const to = q.get('to') ? new Date(q.get('to')!) : null;
      const list = db.sales
        .filter(s => (!from || new Date(s.createdAt) >= from) && (!to || new Date(s.createdAt) < to))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      return done(list);
    }
    const active = db.sales.filter(s => !s.closed).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (seg[1] === 'queue') return done(active);
    if (seg[1] === 'board') {
      const strip = (s: Sale) => ({ id: s.id, number: s.number, readyAt: s.readyAt, startedAt: s.startedAt, createdAt: s.createdAt });
      return done({
        preparing: active.filter(s => !s.readyAt).map(strip),
        ready: active.filter(s => s.readyAt).sort((a, b) => +new Date(b.readyAt!) - +new Date(a.readyAt!)).map(strip),
      });
    }

    if (method === 'POST' && !seg[1]) {
      const { items = [], paymentMethod = 'cash', cashReceived } = body;
      if (!items.length) throw new DemoError(400, 'Чек пуст');
      const need: Record<number, number> = {};
      items.forEach((it: any) => (need[it.productId] = (need[it.productId] || 0) + (it.quantity || 1)));
      for (const [pid, qty] of Object.entries(need)) {
        const p = db.products.find(x => x.id === +pid);
        if (!p || p.archived) throw new DemoError(400, `Товар #${pid} недоступен`);
        if (p.stock < qty) throw new DemoError(409, `Не хватает «${p.name}»: осталось ${p.stock} шт`);
      }
      const total = items.reduce((s: number, it: any) => s + (+it.price || 0) * (it.quantity || 1), 0);
      if (paymentMethod === 'cash' && cashReceived != null && +cashReceived < total) throw new DemoError(400, 'Внесено меньше суммы заказа');
      Object.entries(need).forEach(([pid, qty]) => (db.products.find(x => x.id === +pid)!.stock -= qty));

      const sale: Sale = {
        id: ++db.seq,
        number: db.sales.filter(s => new Date(s.createdAt) >= startOfToday()).length + 1,
        total,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' && cashReceived != null ? +cashReceived : null,
        closed: false,
        createdAt: new Date().toISOString(),
        startedAt: null,
        readyAt: null,
        closedAt: null,
        items: items.flatMap((it: any) =>
          Array.from({ length: it.quantity || 1 }, () => ({
            id: ++db.seq,
            quantity: 1,
            deliveredQty: 0,
            price: +it.price,
            notes: it.notes || null,
            product: db.products.find(x => x.id === it.productId)!,
          }))
        ),
        user: { id: me.id, email: me.email, name: me.name },
      };
      db.sales.push(sale);
      return done(sale);
    }

    const sale = db.sales.find(s => s.id === Number(seg[1]));
    if (!sale) throw new DemoError(404, 'Заказ не найден');
    const now = new Date().toISOString();
    if (seg[2] === 'start') sale.startedAt = now;
    else if (seg[2] === 'items') {
      const item = sale.items.find(i => i.id === Number(seg[3]));
      if (!item) throw new DemoError(404, 'Позиция не найдена');
      item.deliveredQty = seg[4] === 'deliver' ? item.quantity : 0;
      syncReady(sale);
    } else if (seg[2] === 'ready') {
      sale.items.forEach(i => (i.deliveredQty = i.quantity));
      syncReady(sale);
    } else if (seg[2] === 'close') {
      sale.items.forEach(i => (i.deliveredQty = i.quantity));
      sale.readyAt ||= now;
      sale.startedAt ||= now;
      sale.closed = true;
      sale.closedAt = now;
    }
    return done(sale);
  }

  throw new DemoError(404, 'Неизвестный запрос');
}

export function isDemoError(e: unknown): e is DemoError {
  return e instanceof DemoError;
}
