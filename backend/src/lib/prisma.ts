import { PrismaClient } from '@prisma/client';

// Один клиент на всё приложение — иначе каждый роутер держит свой пул соединений
export const prisma = new PrismaClient();
