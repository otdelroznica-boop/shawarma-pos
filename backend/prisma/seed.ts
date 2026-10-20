import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const hash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Администратор', password: hash, role: 'admin' },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Products
  const products = [
    { name: 'Шаурма классическая', price: 450, cost: 180, stock: 100, category: 'Шаурма' },
    { name: 'Шаурма с сыром', price: 520, cost: 210, stock: 80, category: 'Шаурма' },
    { name: 'Шаурма двойная', price: 650, cost: 280, stock: 60, category: 'Шаурма' },
    { name: 'Шаурма в лаваше', price: 400, cost: 160, stock: 90, category: 'Шаурма' },
    { name: 'Шаурма куриная', price: 480, cost: 190, stock: 70, category: 'Шаурма' },
    { name: 'Чай чёрный', price: 100, cost: 20, stock: 200, category: 'Напитки' },
    { name: 'Чай зелёный', price: 100, cost: 20, stock: 200, category: 'Напитки' },
    { name: 'Кофе американо', price: 180, cost: 40, stock: 150, category: 'Напитки' },
    { name: 'Кофе капучино', price: 220, cost: 60, stock: 150, category: 'Напитки' },
    { name: 'Кофе латте', price: 250, cost: 70, stock: 150, category: 'Напитки' },
    { name: 'Айран', price: 120, cost: 30, stock: 100, category: 'Напитки' },
    { name: 'Coca-Cola 0.5л', price: 150, cost: 60, stock: 100, category: 'Напитки' },
    { name: 'Картофель фри', price: 200, cost: 60, stock: 80, category: 'Снэки' },
    { name: 'Наггетсы (6 шт)', price: 280, cost: 100, stock: 60, category: 'Снэки' },
    { name: 'Соус чесночный', price: 50, cost: 10, stock: 300, category: 'Соусы' },
    { name: 'Соус острый', price: 50, cost: 10, stock: 300, category: 'Соусы' },
    { name: 'Соус ткемали', price: 50, cost: 10, stock: 300, category: 'Соусы' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: products.indexOf(p) + 1 },
      update: {},
      create: p,
    });
  }
  console.log(`✅ ${products.length} products seeded`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
