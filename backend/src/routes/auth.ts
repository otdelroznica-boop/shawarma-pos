import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET, requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const SALT_ROUNDS = 10;

const publicUser = (u: { id: number; email: string; name: string | null; role: string }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});

// Вход
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

  const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '12h', // смена кассира
  });
  res.json({ token, user: publicUser(user) });
});

// Кто я
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  res.json(publicUser(user));
});

// Сотрудники — только администратор
router.get('/users', requireAuth, requireRole('admin'), async (_: Request, res: Response) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(users.map(publicUser));
});

// Регистрация сотрудника — только администратор
router.post('/register', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { email, password, role, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Пароль — не короче 6 символов' });
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: {
        email: String(email).trim().toLowerCase(),
        name: name?.trim() || null,
        password: hash,
        role: role === 'admin' ? 'admin' : 'cashier',
      },
    });
    res.status(201).json(publicUser(user));
  } catch {
    res.status(400).json({ error: 'Пользователь с таким email уже есть' });
  }
});

export default router;
