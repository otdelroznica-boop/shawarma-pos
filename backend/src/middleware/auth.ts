import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthRequest extends Request {
  user?: { sub: number; email: string; role: string };
}

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется вход' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
};

export const requireRole = (role: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  next();
};
