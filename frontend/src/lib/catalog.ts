import { Coffee, Droplet, Popcorn, Sandwich, Utensils, type LucideIcon } from 'lucide-react';
import type { Product } from '../api';

export const CATEGORIES = ['Шаурма', 'Снэки', 'Напитки', 'Соусы', 'Прочее'];

/** Цвет и иконка категории — одинаковые на кассе, в очереди и в отчётах */
export const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tile: string; dot: string; bar: string }> = {
  'Шаурма': { icon: Sandwich, tile: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500', bar: '#f76510' },
  'Снэки': { icon: Popcorn, tile: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', bar: '#d99a06' },
  'Напитки': { icon: Coffee, tile: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500', bar: '#0e8fd0' },
  'Соусы': { icon: Droplet, tile: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', bar: '#e0386a' },
  'Прочее': { icon: Utensils, tile: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400', bar: '#9c958a' },
};

export const categoryStyle = (c?: string) => CATEGORY_STYLE[c || 'Прочее'] ?? CATEGORY_STYLE['Прочее'];

// Добавки к шаурме
export const SHAWARMA_TOPPINGS = [
  { id: 'cheese', name: 'Двойной сыр', price: 60 },
  { id: 'jalapeno', name: 'Халапеньо', price: 40 },
  { id: 'extra_meat', name: 'Доп. порция мяса', price: 80 },
  { id: 'crispy_onion', name: 'Хрустящий лук', price: 30 },
  { id: 'mushrooms', name: 'Шампиньоны', price: 50 },
];

// Соусы к снэкам (картофель фри, наггетсы)
export const SNACK_SAUCES = [
  { id: 'cheese', name: 'Сырный', price: 50 },
  { id: 'garlic', name: 'Чесночный', price: 50 },
  { id: 'spicy', name: 'Острый томатный', price: 50 },
  { id: 'tkemali', name: 'Ткемали', price: 50 },
];

export const hasModifiers = (category: string) => category === 'Шаурма' || category === 'Снэки';

// Шаурма первой, дальше снэки, напитки, соусы — как в меню над стойкой
export const catRank = (c: string) => {
  const i = CATEGORIES.indexOf(c);
  return i < 0 ? CATEGORIES.length : i;
};

export const sortByCategory = (list: Product[]) =>
  [...list].sort((a, b) => catRank(a.category) - catRank(b.category) || Number(a.price) - Number(b.price));
