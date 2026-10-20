import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const withItems = {
  items: { include: { product: true }, orderBy: { id: 'asc' as const } },
  user: { select: { id: true, email: true, name: true } },
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── Список продаж за период (?from=ISO&to=ISO) ───────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lt = new Date(to);

  const sales = await prisma.sale.findMany({
    where: from || to ? { createdAt } : undefined,
    include: withItems,
    orderBy: { createdAt: 'desc' },
  });
  res.json(sales);
});

// ─── Очередь активных заказов (кухня / выдача) ──────────────────────────────
router.get('/queue', async (_: Request, res: Response) => {
  const sales = await prisma.sale.findMany({
    where: { closed: false },
    include: withItems,
    orderBy: { createdAt: 'asc' }, // сначала самые ранние
  });
  res.json(sales);
});

// ─── Табло для гостей: номера «готовится» и «можно забирать» ─────────────────
router.get('/board', async (_: Request, res: Response) => {
  const sales = await prisma.sale.findMany({
    where: { closed: false },
    select: { id: true, number: true, readyAt: true, startedAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    preparing: sales.filter(s => !s.readyAt),
    ready: sales.filter(s => s.readyAt).sort((a, b) => +b.readyAt! - +a.readyAt!),
  });
});

// ─── Создание чека ────────────────────────────────────────────────────────────
// items: [{ productId, quantity, price, notes? }], paymentMethod: 'cash' | 'card', cashReceived?
router.post('/', async (req: AuthRequest, res: Response) => {
  const { items, paymentMethod = 'cash', cashReceived } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Чек пуст' });
  }
  if (!['cash', 'card'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Неизвестный способ оплаты' });
  }
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'Пользователь не определён' });

  // Каждая штука — отдельная строка, чтобы повар отмечал каждую позицию
  const unrolled: { productId: number; price: number; notes: string | null }[] = [];
  for (const it of items) {
    const count = Math.max(1, Number(it.quantity) || 1);
    for (let i = 0; i < count; i++) {
      unrolled.push({ productId: Number(it.productId), price: Number(it.price) || 0, notes: it.notes || null });
    }
  }
  // Сумму считаем на сервере, а не берём из запроса
  const total = unrolled.reduce((s, it) => s + it.price, 0);

  if (paymentMethod === 'cash' && cashReceived != null && Number(cashReceived) < total) {
    return res.status(400).json({ error: 'Внесено меньше суммы заказа' });
  }

  const need: Record<number, number> = {};
  for (const it of unrolled) need[it.productId] = (need[it.productId] || 0) + 1;

  try {
    const sale = await prisma.$transaction(async tx => {
      const products = await tx.product.findMany({ where: { id: { in: Object.keys(need).map(Number) } } });
      for (const [id, qty] of Object.entries(need)) {
        const p = products.find(x => x.id === Number(id));
        if (!p || p.archived) throw new HttpError(400, `Товар #${id} недоступен`);
        if (p.stock < qty) throw new HttpError(409, `Не хватает «${p.name}»: осталось ${p.stock} шт`);
      }

      const todayCount = await tx.sale.count({ where: { createdAt: { gte: startOfToday() } } });

      const created = await tx.sale.create({
        data: {
          number: todayCount + 1,
          total,
          paymentMethod,
          cashReceived: paymentMethod === 'cash' && cashReceived != null ? Number(cashReceived) : null,
          userId,
          items: {
            create: unrolled.map(it => ({
              quantity: 1,
              price: it.price,
              notes: it.notes,
              product: { connect: { id: it.productId } },
            })),
          },
        },
        include: withItems,
      });

      for (const [id, qty] of Object.entries(need)) {
        await tx.product.update({ where: { id: Number(id) }, data: { stock: { decrement: qty } } });
      }
      return created;
    });

    res.status(201).json(sale);
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── Взять заказ в работу (запуск таймера готовки) ──────────────────────────
router.put('/:saleId/start', async (req: Request, res: Response) => {
  try {
    const sale = await prisma.sale.update({
      where: { id: Number(req.params.saleId) },
      data: { startedAt: new Date() },
      include: withItems,
    });
    res.json(sale);
  } catch {
    res.status(404).json({ error: 'Заказ не найден' });
  }
});

// После любой отметки позиции пересчитываем: всё собрано → заказ «готов» (номер на табло)
async function syncReady(saleId: number) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale) return null;
  const allDone = sale.items.every(i => i.deliveredQty >= i.quantity);
  if (allDone && !sale.readyAt) {
    return prisma.sale.update({
      where: { id: saleId },
      data: { readyAt: new Date(), startedAt: sale.startedAt ?? new Date() },
      include: withItems,
    });
  }
  if (!allDone && sale.readyAt) {
    return prisma.sale.update({ where: { id: saleId }, data: { readyAt: null }, include: withItems });
  }
  return prisma.sale.findUnique({ where: { id: saleId }, include: withItems });
}

// ─── Отметить позицию как собранную ──────────────────────────────────────────
router.put('/:saleId/items/:itemId/deliver', async (req: Request, res: Response) => {
  const saleId = Number(req.params.saleId);
  const itemId = Number(req.params.itemId);
  const item = await prisma.saleItem.findFirst({ where: { id: itemId, saleId } });
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });

  await prisma.saleItem.update({ where: { id: itemId }, data: { deliveredQty: item.quantity } });
  res.json(await syncReady(saleId));
});

// ─── Снять отметку с позиции (undo) ──────────────────────────────────────────
router.put('/:saleId/items/:itemId/undeliver', async (req: Request, res: Response) => {
  const saleId = Number(req.params.saleId);
  const itemId = Number(req.params.itemId);
  const item = await prisma.saleItem.findFirst({ where: { id: itemId, saleId } });
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });

  await prisma.saleItem.update({ where: { id: itemId }, data: { deliveredQty: 0 } });
  res.json(await syncReady(saleId));
});

// ─── Весь заказ готов (без поштучных отметок) ────────────────────────────────
router.put('/:saleId/ready', async (req: Request, res: Response) => {
  const saleId = Number(req.params.saleId);
  const items = await prisma.saleItem.findMany({ where: { saleId } });
  if (items.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
  await prisma.$transaction(
    items.map(it => prisma.saleItem.update({ where: { id: it.id }, data: { deliveredQty: it.quantity } }))
  );
  res.json(await syncReady(saleId));
});

// ─── Выдать гостю: заказ уходит из очереди и с табло ─────────────────────────
router.put('/:saleId/close', async (req: Request, res: Response) => {
  const saleId = Number(req.params.saleId);
  const items = await prisma.saleItem.findMany({ where: { saleId } });
  if (items.length === 0) return res.status(404).json({ error: 'Заказ не найден' });

  const now = new Date();
  const [, sale] = await prisma.$transaction([
    prisma.saleItem.updateMany({ where: { saleId }, data: { deliveredQty: 1 } }),
    prisma.sale.update({ where: { id: saleId }, data: { closed: true, closedAt: now }, include: withItems }),
  ]);
  if (!sale.readyAt) {
    await prisma.sale.update({ where: { id: saleId }, data: { readyAt: now, startedAt: sale.startedAt ?? now } });
  }
  res.json(sale);
});

export default router;
