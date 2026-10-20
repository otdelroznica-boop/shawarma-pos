import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, ChefHat, Clock, Flame, HandPlatter, Printer, RefreshCw } from 'lucide-react';
import { api, type Sale, type SaleItem } from '../api';
import { catRank, categoryStyle } from '../lib/catalog';
import { formatTime, mmss, orderNo, plural, rub, secondsSince } from '../lib/format';
import { PageHeader, useToast } from './ui';
import { Receipt, usePrint } from './Receipt';

// Нормы времени готовки, секунды
const WARN_AFTER = 5 * 60;
const LATE_AFTER = 10 * 60;

const SOUND_KEY = 'pos:kitchen-sound';

function useNow(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

// Короткий двойной сигнал без файлов — через WebAudio
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.16);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* браузер без звука — не критично */
  }
}

// Повару удобнее: сначала то, что готовится дольше (шаурма), напитки — в конце
const kitchenOrder = (items: SaleItem[]) =>
  [...items].sort((a, b) => catRank(a.product.category) - catRank(b.product.category) || a.id - b.id);

type Stage = 'new' | 'cooking' | 'ready';
const stageOf = (s: Sale): Stage => (s.readyAt ? 'ready' : s.startedAt ? 'cooking' : 'new');

const COLUMNS: { id: Stage; title: string; hint: string; accent: string }[] = [
  { id: 'new', title: 'Новые', hint: 'ждут начала', accent: 'bg-sky-500' },
  { id: 'cooking', title: 'Готовятся', hint: 'идёт таймер', accent: 'bg-brand-500' },
  { id: 'ready', title: 'Готовы', hint: 'номер на табло', accent: 'bg-emerald-500' },
];

function Timer({ sale }: { sale: Sale }) {
  const from = sale.startedAt || sale.createdAt;
  const sec = sale.readyAt
    ? Math.max(0, Math.floor((new Date(sale.readyAt).getTime() - new Date(from).getTime()) / 1000))
    : secondsSince(from);
  const tone = sale.readyAt
    ? 'bg-emerald-100 text-emerald-800'
    : sec >= LATE_AFTER
      ? 'bg-red-600 text-white'
      : sec >= WARN_AFTER
        ? 'bg-amber-100 text-amber-800'
        : 'bg-ink-100 text-ink-700';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${tone}`}>
      {sec >= LATE_AFTER && !sale.readyAt ? <Flame size={15} /> : <Clock size={15} />}
      {mmss(sec)}
    </span>
  );
}

function OrderCard({
  sale,
  busy,
  onItem,
  onAction,
  onPrint,
  fresh,
}: {
  sale: Sale;
  busy: boolean;
  onItem: (item: SaleItem) => void;
  onAction: () => void;
  onPrint: () => void;
  fresh: boolean;
}) {
  const stage = stageOf(sale);
  const done = sale.items.filter(i => i.deliveredQty >= i.quantity).length;
  const late = stage !== 'ready' && secondsSince(sale.startedAt || sale.createdAt) >= LATE_AFTER;

  const action =
    stage === 'new'
      ? { label: 'Начать готовить', icon: ChefHat, cls: 'btn-dark' }
      : stage === 'cooking'
        ? { label: 'Всё готово', icon: CheckCheck, cls: 'btn-primary' }
        : { label: 'Выдать гостю', icon: HandPlatter, cls: 'btn bg-emerald-600 text-white hover:bg-emerald-700' };

  return (
    <article
      className={`card overflow-hidden ${late ? 'ring-2 ring-red-500' : ''} ${fresh ? 'animate-flash' : ''} ${
        stage === 'ready' ? 'border-emerald-200' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight tabular-nums">{orderNo(sale.number)}</span>
          <span className="text-xs text-ink-400">{formatTime(sale.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer sale={sale} />
          <button onClick={onPrint} title="Печать стикера" className="btn-ghost h-8 w-8 rounded-lg">
            <Printer size={16} />
          </button>
        </div>
      </header>

      <ul className="divide-y divide-ink-100">
        {kitchenOrder(sale.items).map(item => {
          const ok = item.deliveredQty >= item.quantity;
          const st = categoryStyle(item.product.category);
          return (
            <li key={item.id}>
              <button
                onClick={() => onItem(item)}
                disabled={busy}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-ink-50 ${ok ? 'bg-emerald-50/50' : ''}`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                    ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 bg-white'
                  }`}
                >
                  {ok && <Check size={15} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 font-semibold ${ok ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                    <st.icon size={15} className="shrink-0 text-ink-400" />
                    {item.product.name}
                  </span>
                  {item.notes && (
                    <span className={`mt-0.5 block text-sm font-medium ${ok ? 'text-ink-400' : 'text-brand-700'}`}>{item.notes}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center gap-3 border-t border-ink-100 bg-ink-50/60 px-4 py-3">
        <div className="text-xs leading-tight text-ink-500">
          <div>
            собрано {done}/{sale.items.length}
          </div>
          <div className="font-semibold text-ink-700">{rub(sale.total)}</div>
        </div>
        <button onClick={onAction} disabled={busy} className={`${action.cls} ml-auto h-11 px-4 text-sm`}>
          <action.icon size={17} />
          {action.label}
        </button>
      </footer>
    </article>
  );
}

interface QueuePageProps {
  onQueueCountChange?: (count: number) => void;
}

export default function QueuePage({ onQueueCountChange }: QueuePageProps) {
  const toast = useToast();
  const [queue, setQueue] = useState<Sale[]>([]);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off');
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const known = useRef<Set<number> | null>(null);
  useNow();

  usePrint(printSale, useCallback(() => setPrintSale(null), []));

  const load = useCallback(async () => {
    try {
      const data = await api.getQueue();
      // Новые заказы — подсветка и звук (кроме первой загрузки)
      if (known.current) {
        const added = data.filter(s => !known.current!.has(s.id)).map(s => s.id);
        if (added.length) {
          setFresh(new Set(added));
          setTimeout(() => setFresh(new Set()), 3200);
          if (localStorage.getItem(SOUND_KEY) !== 'off') beep();
        }
      }
      known.current = new Set(data.map(s => s.id));
      setQueue(data);
      onQueueCountChange?.(data.length);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }, [onQueueCountChange, toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (saleId: number, fn: () => Promise<Sale>, message?: string) => {
    setBusy(b => new Set(b).add(saleId));
    try {
      const updated = await fn();
      setQueue(q => {
        const next = updated.closed ? q.filter(s => s.id !== saleId) : q.map(s => (s.id === saleId ? updated : s));
        onQueueCountChange?.(next.length);
        return next;
      });
      if (message) toast(message);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(b => {
        const n = new Set(b);
        n.delete(saleId);
        return n;
      });
    }
  };

  const onItem = (sale: Sale, item: SaleItem) =>
    run(sale.id, () =>
      item.deliveredQty >= item.quantity ? api.undeliverItem(sale.id, item.id) : api.deliverItem(sale.id, item.id)
    );

  const onAction = (sale: Sale) => {
    const stage = stageOf(sale);
    if (stage === 'new') return run(sale.id, () => api.startSale(sale.id));
    if (stage === 'cooking') return run(sale.id, () => api.markReady(sale.id), `Заказ ${orderNo(sale.number)} готов`);
    return run(sale.id, () => api.closeSale(sale.id), `Заказ ${orderNo(sale.number)} выдан`);
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    if (next) beep();
  };

  const late = queue.filter(s => !s.readyAt && secondsSince(s.startedAt || s.createdAt) >= LATE_AFTER).length;

  return (
    <div className="flex h-full flex-col p-5">
      <PageHeader
        title="Кухня"
        subtitle={
          queue.length === 0
            ? 'Активных заказов нет'
            : `${queue.length} ${plural(queue.length, 'заказ', 'заказа', 'заказов')} в работе${late ? ` · задерживается: ${late}` : ''}`
        }
        actions={
          <>
            <button onClick={toggleSound} className="btn-outline h-10 px-3 text-sm" title="Звук при новом заказе">
              {sound ? <Bell size={16} /> : <BellOff size={16} />}
              {sound ? 'Звук включён' : 'Без звука'}
            </button>
            <button onClick={load} className="btn-outline h-10 px-3 text-sm">
              <RefreshCw size={16} />
              Обновить
            </button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map(col => {
          const items = queue.filter(s => stageOf(s) === col.id);
          return (
            <section key={col.id} className="flex min-h-0 flex-col rounded-2xl bg-ink-200/50 p-2">
              <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
                <h2 className="font-bold">{col.title}</h2>
                <span className="rounded-full bg-white px-2 text-sm font-semibold tabular-nums text-ink-600">{items.length}</span>
                <span className="ml-auto text-xs text-ink-500">{col.hint}</span>
              </div>
              <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-0.5">
                {items.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-ink-300/70 py-10 text-center text-sm text-ink-400">пусто</div>
                ) : (
                  items.map(sale => (
                    <OrderCard
                      key={sale.id}
                      sale={sale}
                      busy={busy.has(sale.id)}
                      fresh={fresh.has(sale.id)}
                      onItem={item => onItem(sale, item)}
                      onAction={() => onAction(sale)}
                      onPrint={() => setPrintSale(sale)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {printSale && <Receipt sale={printSale} kind="sticker" />}
    </div>
  );
}
