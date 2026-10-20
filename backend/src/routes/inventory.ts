import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v === '' || v == null ? NaN : Number(v));

// Получить товары (?all=1 — вместе с архивными, для каталога)
router.get('/products', async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: req.query.all ? undefined : { archived: false },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json(products);
});

// Создать товар
router.post('/products', requireRole('admin'), async (req: Request, res: Response) => {
  const { name, category } = req.body;
  const price = toNum(req.body.price);
  const cost = toNum(req.body.cost);
  const stock = toNum(req.body.stock);
  if (!name?.trim() || [price, cost, stock].some(Number.isNaN)) {
    return res.status(400).json({ error: 'Заполните название, цену, себестоимость и остаток' });
  }
  if (price < 0 || cost < 0) return res.status(400).json({ error: 'Цена не может быть отрицательной' });
  const product = await prisma.product.create({
    data: { name: name.trim(), price, cost, stock: Math.trunc(stock), category: category || 'Прочее' },
  });
  res.status(201).json(product);
});

// Обновить товар
router.put('/products/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const { name, category, archived } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (category !== undefined) data.category = category;
  if (archived !== undefined) data.archived = !!archived;
  for (const f of ['price', 'cost', 'stock'] as const) {
    if (req.body[f] === undefined) continue;
    const n = toNum(req.body[f]);
    if (Number.isNaN(n)) return res.status(400).json({ error: `Некорректное значение: ${f}` });
    data[f] = f === 'stock' ? Math.trunc(n) : n;
  }
  try {
    const product = await prisma.product.update({ where: { id: Number(req.params.id) }, data });
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Товар не найден' });
  }
});

// Приход / списание: delta > 0 — приход, < 0 — списание
router.post('/products/:id/adjust', requireRole('admin'), async (req: Request, res: Response) => {
  const delta = Math.trunc(toNum(req.body.delta));
  if (Number.isNaN(delta) || delta === 0) return res.status(400).json({ error: 'Укажите количество' });
  try {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { stock: { increment: delta } },
    });
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Товар не найден' });
  }
});

// Удалить товар. Если по нему были продажи — не удаляем, а отправляем в архив,
// иначе потеряется история в отчётах
router.delete('/products/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const used = await prisma.saleItem.count({ where: { productId: id } });
  try {
    if (used > 0) {
      await prisma.product.update({ where: { id }, data: { archived: true } });
      return res.json({ ok: true, archived: true });
    }
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true, archived: false });
  } catch {
    res.status(404).json({ error: 'Товар не найден' });
  }
});

export default router;
