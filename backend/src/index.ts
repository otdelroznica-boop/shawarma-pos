import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import salesRouter from './routes/sales';
import inventoryRouter from './routes/inventory';
import authRouter from './routes/auth';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_: Request, res: Response) => {
  res.send('Shawarma POS backend is running');
});

app.get('/api/health', async (_: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false, error: 'База данных недоступна' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/sales', salesRouter);
app.use('/api/inventory', inventoryRouter);

// Любая необработанная ошибка — JSON, а не HTML-страница Express
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\nShawarma POS backend running -> http://localhost:${PORT}\n`);
});
