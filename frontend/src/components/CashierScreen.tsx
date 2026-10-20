import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Check,
  Copy,
  CreditCard,
  Plus,
  Printer,
  Receipt as ReceiptIcon,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api, type PaymentMethod, type Product, type Sale } from '../api';
import { categoryStyle, hasModifiers, sortByCategory, SHAWARMA_TOPPINGS, SNACK_SAUCES } from '../lib/catalog';
import { num, orderNo, plural, rub } from '../lib/format';
import { Empty, Modal, useToast } from './ui';
import { Receipt, usePrint } from './Receipt';

interface CartItem {
  cartId: string; // каждая штука — отдельная строка, кухня отмечает их по одной
  productId: number;
  name: string;
  category: string;
  finalPrice: number;
  notes?: string;
}

interface Props {
  onGoToQueue?: () => void;
}

let cartSeq = 0;
const newCartId = () => `c${++cartSeq}`;

// ─── Окно добавок / соуса / напитка ─────────────────────────────────────────
function ModifiersModal({
  product,
  drinks,
  onClose,
  onAdd,
}: {
  product: Product | null;
  drinks: Product[];
  onClose: () => void;
  onAdd: (lines: Omit<CartItem, 'cartId'>[]) => void;
}) {
  const [toppings, setToppings] = useState<string[]>([]);
  const [sauce, setSauce] = useState<string | null>(null);
  const [drink, setDrink] = useState<Product | null>(null);

  useEffect(() => {
    if (!product) return;
    setToppings([]);
    setSauce(product.category === 'Снэки' ? 'cheese' : null);
    setDrink(null);
  }, [product]);

  if (!product) return null;
  const isShawarma = product.category === 'Шаурма';
  const base = Number(product.price);

  const toppingsSum = toppings.reduce((s, id) => s + (SHAWARMA_TOPPINGS.find(t => t.id === id)?.price || 0), 0);
  const sauceObj = SNACK_SAUCES.find(s => s.id === sauce);
  const extra = isShawarma ? toppingsSum : sauceObj?.price || 0;
  const total = base + extra + (drink ? Number(drink.price) : 0);

  const build = (plain: boolean) => {
    const notes: string[] = [];
    let price = base;
    if (!plain) {
      if (isShawarma) {
        toppings.forEach(id => {
          const t = SHAWARMA_TOPPINGS.find(x => x.id === id)!;
          price += t.price;
          notes.push(`+ ${t.name}`);
        });
      } else if (sauceObj) {
        price += sauceObj.price;
        notes.push(`соус ${sauceObj.name.toLowerCase()}`);
      }
    }
    const lines: Omit<CartItem, 'cartId'>[] = [
      { productId: product.id, name: product.name, category: product.category, finalPrice: price, notes: notes.join(', ') || undefined },
    ];
    if (!plain && drink) {
      lines.push({ productId: drink.id, name: drink.name, category: drink.category, finalPrice: Number(drink.price) });
    }
    onAdd(lines);
  };

  const Option = ({ active, onClick, title, price }: { active: boolean; onClick: () => void; title: string; price: number }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
        active ? 'border-brand-500 bg-brand-50 font-semibold text-ink-900 ring-2 ring-brand-100' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            active ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300'
          }`}
        >
          {active && <Check size={13} strokeWidth={3} />}
        </span>
        {title}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold text-brand-600">+{price} ₽</span>
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      subtitle={`Базовая цена ${rub(base)}`}
      footer={
        <div className="flex gap-2.5">
          <button onClick={() => build(true)} className="btn-outline h-12 flex-1 text-sm">
            Без добавок · {rub(base)}
          </button>
          <button onClick={() => build(false)} className="btn-primary h-12 flex-[1.4] text-base">
            В чек · {rub(total)}
          </button>
        </div>
      }
    >
      {isShawarma ? (
        <section className="mb-6">
          <div className="label">Добавки</div>
          <div className="grid grid-cols-2 gap-2">
            {SHAWARMA_TOPPINGS.map(t => (
              <Option
                key={t.id}
                active={toppings.includes(t.id)}
                onClick={() => setToppings(p => (p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id]))}
                title={t.name}
                price={t.price}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-6">
          <div className="label">Соус</div>
          <div className="grid grid-cols-2 gap-2">
            {SNACK_SAUCES.map(s => (
              <Option key={s.id} active={sauce === s.id} onClick={() => setSauce(s.id)} title={s.name} price={s.price} />
            ))}
            <button
              type="button"
              onClick={() => setSauce(null)}
              className={`col-span-2 rounded-xl border py-2.5 text-sm font-medium transition ${
                sauce === null ? 'border-ink-400 bg-ink-100 text-ink-900' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
              }`}
            >
              Без соуса
            </button>
          </div>
        </section>
      )}

      {drinks.length > 0 && (
        <section className="rounded-2xl bg-sky-50 p-4">
          <div className="mb-2 text-sm font-semibold text-sky-900">Предложите напиток</div>
          <div className="grid grid-cols-2 gap-2">
            {drinks.slice(0, 6).map(d => {
              const active = drink?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDrink(active ? null : d)}
                  disabled={d.stock <= 0}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${
                    active ? 'border-sky-500 bg-white font-semibold ring-2 ring-sky-200' : 'border-sky-200 bg-white/70 hover:bg-white'
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-sky-700">+{num(d.price)} ₽</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </Modal>
  );
}

// ─── Окно оплаты ─────────────────────────────────────────────────────────────
function PaymentModal({
  open,
  total,
  onClose,
  onPay,
  busy,
}: {
  open: boolean;
  total: number;
  onClose: () => void;
  onPay: (method: PaymentMethod, cash?: number) => void;
  busy: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cash, setCash] = useState('');

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setCash('');
    }
  }, [open]);

  const cashNum = cash === '' ? total : Number(cash);
  const change = cashNum - total;
  const notEnough = method === 'cash' && change < 0;

  // Быстрые купюры: ближайшие «круглые» суммы больше итога
  const quick = useMemo(() => {
    const set = new Set<number>();
    for (const step of [100, 500, 1000]) set.add(Math.ceil(total / step) * step);
    [1000, 2000, 5000].forEach(v => v >= total && set.add(v));
    set.delete(total);
    return [...set].filter(v => v > total).sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  const submit = () => {
    if (busy || notEnough) return;
    onPay(method, method === 'cash' ? cashNum : undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Оплата"
      subtitle={`К оплате ${rub(total)}`}
      width="max-w-md"
      footer={
        <button onClick={submit} disabled={busy || notEnough} className="btn-primary h-14 w-full text-lg">
          {busy ? 'Проводим…' : method === 'card' ? `Оплачено картой · ${rub(total)}` : `Принять ${rub(cashNum)}`}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {([
          ['cash', 'Наличные', Banknote],
          ['card', 'Карта / СБП', CreditCard],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMethod(id)}
            className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 text-sm font-semibold transition ${
              method === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
            }`}
          >
            <Icon size={24} />
            {label}
          </button>
        ))}
      </div>

      {method === 'cash' ? (
        <div className="mt-5">
          <label className="label">Внесено гостем</label>
          <input
            autoFocus
            inputMode="numeric"
            value={cash}
            onChange={e => setCash(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={num(total)}
            className="input h-14 text-2xl font-bold tabular-nums"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setCash(String(total))} className="btn-outline px-3 py-2 text-sm">
              Без сдачи
            </button>
            {quick.map(v => (
              <button key={v} onClick={() => setCash(String(v))} className="btn-outline px-3 py-2 text-sm tabular-nums">
                {num(v)}
              </button>
            ))}
          </div>
          <div
            className={`mt-5 flex items-baseline justify-between rounded-2xl px-5 py-4 ${
              notEnough ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            <span className="font-semibold">{notEnough ? 'Не хватает' : 'Сдача'}</span>
            <span className="text-3xl font-bold tabular-nums">{rub(Math.abs(change))}</span>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-ink-50 px-5 py-4 text-sm text-ink-600">
          Проведите оплату на терминале, затем подтвердите здесь. Сумма к оплате: <b className="text-ink-900">{rub(total)}</b>.
        </p>
      )}
    </Modal>
  );
}

// ─── Экран кассы ─────────────────────────────────────────────────────────────
export default function CashierScreen({ onGoToQueue }: Props) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [modProduct, setModProduct] = useState<Product | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);

  const loadProducts = useCallback(
    () =>
      api
        .getProducts()
        .then(list => setProducts(sortByCategory(list)))
        .catch(e => toast(e.message, 'error'))
        .finally(() => setLoaded(true)),
    [toast]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  usePrint(printSale, useCallback(() => setPrintSale(null), []));

  const categories = useMemo(() => ['Все', ...Array.from(new Set(products.map(p => p.category || 'Прочее')))], [products]);
  const drinks = useMemo(() => products.filter(p => p.category === 'Напитки'), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      p => (category === 'Все' || p.category === category) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, search, category]);

  // Сколько штук товара уже в чеке — чтобы не продать больше остатка
  const inCart = useMemo(() => {
    const m: Record<number, number> = {};
    cart.forEach(i => (m[i.productId] = (m[i.productId] || 0) + 1));
    return m;
  }, [cart]);

  const left = (p: Product) => p.stock - (inCart[p.id] || 0);

  const addLines = (lines: Omit<CartItem, 'cartId'>[]) => {
    setCart(prev => [...prev, ...lines.map(l => ({ ...l, cartId: newCartId() }))]);
    setModProduct(null);
    setTimeout(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
  };

  const pick = (p: Product) => {
    if (left(p) <= 0) {
      toast(`«${p.name}» закончился`, 'error');
      return;
    }
    if (hasModifiers(p.category)) setModProduct(p);
    else addLines([{ productId: p.id, name: p.name, category: p.category, finalPrice: Number(p.price) }]);
  };

  const duplicate = (item: CartItem) => {
    const p = products.find(x => x.id === item.productId);
    if (p && left(p) <= 0) return toast(`«${p.name}» больше нет на остатке`, 'error');
    const { cartId, ...rest } = item;
    addLines([rest]);
  };

  const total = cart.reduce((s, i) => s + i.finalPrice, 0);

  const pay = async (method: PaymentMethod, cash?: number) => {
    setPaying(true);
    try {
      const sale = await api.createSale(
        cart.map(i => ({ productId: i.productId, quantity: 1, price: i.finalPrice, notes: i.notes })),
        method,
        cash
      );
      setCart([]);
      setPayOpen(false);
      setDone(sale);
      loadProducts();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setPaying(false);
    }
  };

  // Горячие клавиши: «/» — поиск, F9 — оплата, Esc — очистить поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (modProduct || payOpen || done) return;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F9' && cart.length) {
        e.preventDefault();
        setPayOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length, modProduct, payOpen, done]);

  return (
    <div className="flex h-full">
      {/* ─── Каталог ─── */}
      <section className="flex min-w-0 flex-1 flex-col p-4 xl:p-5">
        <div className="relative mb-4">
          <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('');
              if (e.key === 'Enter' && filtered.length === 1) {
                pick(filtered[0]);
                setSearch('');
              }
            }}
            placeholder="Поиск товара"
            className="input h-12 rounded-2xl pl-12 pr-24 text-base shadow-card"
          />
          <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
            /
          </kbd>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map(c => {
            const active = category === c;
            const st = c === 'Все' ? null : categoryStyle(c);
            const count = c === 'Все' ? products.length : products.filter(p => p.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  active ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-700 shadow-card hover:bg-ink-50'
                }`}
              >
                {st && <st.icon size={16} className={active ? 'text-brand-300' : 'text-ink-400'} />}
                {c}
                <span className={`text-xs ${active ? 'text-ink-400' : 'text-ink-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1 pb-2">
          {loaded && filtered.length === 0 ? (
            <Empty icon={Search} title="Ничего не найдено" hint="Измените запрос или выберите другую категорию" />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {filtered.map(p => {
                const st = categoryStyle(p.category);
                const rest = left(p);
                const qty = inCart[p.id] || 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => pick(p)}
                    disabled={rest <= 0}
                    className="group relative flex min-h-[124px] flex-col rounded-2xl border border-ink-200/70 bg-white p-3.5 text-left xl:p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${st.tile}`}>
                        <st.icon size={21} />
                      </div>
                      {qty > 0 && (
                        <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-brand-500 px-2 text-sm font-bold text-white">
                          {qty}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex-1 text-[15px] font-semibold leading-snug text-ink-900">{p.name}</div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <span className="whitespace-nowrap text-lg font-bold tabular-nums text-ink-900">{rub(p.price)}</span>
                      <span
                        className={`whitespace-nowrap text-xs font-medium ${
                          rest <= 0 ? 'text-red-600' : rest < 10 ? 'text-amber-600' : 'text-ink-400'
                        }`}
                      >
                        {rest <= 0 ? 'нет' : `${rest} шт`}
                      </span>
                    </div>
                    {hasModifiers(p.category) && (
                      <span className="absolute bottom-[52px] right-4 text-[11px] font-medium text-ink-400 opacity-0 transition group-hover:opacity-100">
                        + добавки
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Чек ─── */}
      <aside className="flex w-[340px] shrink-0 flex-col border-l border-ink-200 bg-white xl:w-[400px] 2xl:w-[420px]">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Текущий заказ</h2>
            <div className="text-sm text-ink-500">
              {cart.length ? `${cart.length} ${plural(cart.length, 'позиция', 'позиции', 'позиций')}` : 'пусто'}
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="btn-ghost px-3 py-2 text-sm text-ink-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
              Очистить
            </button>
          )}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
          {cart.length === 0 ? (
            <Empty icon={ReceiptIcon} title="Добавьте товары" hint="Нажмите на карточку слева. Шаурма и снэки откроют выбор добавок" />
          ) : (
            <ul className="space-y-1">
              {cart.map((item, i) => {
                const st = categoryStyle(item.category);
                return (
                  <li
                    key={item.cartId}
                    className="group flex animate-slide-up items-start gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-ink-50"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium leading-snug text-ink-900">{item.name}</div>
                      {item.notes && <div className="mt-0.5 text-[13px] text-brand-700">{item.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="mr-1 whitespace-nowrap pt-px text-[15px] font-semibold tabular-nums">{num(item.finalPrice)} ₽</span>
                      <button
                        onClick={() => duplicate(item)}
                        title="Ещё такую же"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 opacity-0 transition hover:bg-white hover:text-ink-900 group-hover:opacity-100"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        onClick={() => setCart(c => c.filter(x => x.cartId !== item.cartId))}
                        title="Убрать"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <span className="sr-only">позиция {i + 1}</span>
                  </li>
                );
              })}
              <div ref={listEnd} />
            </ul>
          )}
        </div>

        <div className="border-t border-ink-100 bg-ink-50/70 px-5 pb-5 pt-4">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="font-medium text-ink-500">Итого</span>
            <span className="text-4xl font-bold tracking-tight tabular-nums">{rub(total)}</span>
          </div>
          <button onClick={() => setPayOpen(true)} disabled={!cart.length} className="btn-primary h-16 w-full text-lg">
            Оплатить
            <kbd className="rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-medium">F9</kbd>
          </button>
        </div>
      </aside>

      <ModifiersModal product={modProduct} drinks={drinks} onClose={() => setModProduct(null)} onAdd={addLines} />

      <PaymentModal open={payOpen} total={total} onClose={() => setPayOpen(false)} onPay={pay} busy={paying} />

      {/* ─── Заказ принят ─── */}
      <Modal open={!!done} onClose={() => setDone(null)} width="max-w-sm">
        {done && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={30} strokeWidth={3} />
            </div>
            <div className="text-sm font-medium text-ink-500">Номер заказа</div>
            <div className="my-1 text-7xl font-black tracking-tight tabular-nums text-ink-900">{orderNo(done.number)}</div>
            <div className="text-sm text-ink-500">
              {rub(done.total)} · {done.paymentMethod === 'card' ? 'картой' : 'наличными'}
              {done.paymentMethod === 'cash' && done.cashReceived != null && Number(done.cashReceived) > Number(done.total) && (
                <>
                  {' '}
                  · сдача <b className="text-ink-900">{rub(Number(done.cashReceived) - Number(done.total))}</b>
                </>
              )}
            </div>
            <div className="mt-6 grid gap-2">
              <button autoFocus onClick={() => setDone(null)} className="btn-primary h-12 text-base">
                <Plus size={18} />
                Новый заказ
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPrintSale(done)} className="btn-outline h-11 text-sm">
                  <Printer size={16} />
                  Чек
                </button>
                {onGoToQueue && (
                  <button
                    onClick={() => {
                      setDone(null);
                      onGoToQueue();
                    }}
                    className="btn-outline h-11 text-sm"
                  >
                    На кухню
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {printSale && <Receipt sale={printSale} kind="receipt" />}
    </div>
  );
}
