import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, ChevronDown, CreditCard, Download, Receipt as ReceiptIcon } from 'lucide-react';
import { api, type Sale } from '../api';
import { categoryStyle } from '../lib/catalog';
import { durationText, formatDateTime, formatTime, num, orderNo, plural, rub } from '../lib/format';
import { Empty, PageHeader, Segmented, useToast } from './ui';

type Period = 'today' | 'yesterday' | 'week' | 'month';

function periodRange(p: Period): [Date, Date] {
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (p === 'today') return [d0, new Date(d0.getTime() + day)];
  if (p === 'yesterday') return [new Date(d0.getTime() - day), d0];
  if (p === 'week') return [new Date(d0.getTime() - 6 * day), new Date(d0.getTime() + day)];
  return [new Date(d0.getFullYear(), d0.getMonth(), 1), new Date(d0.getTime() + day)];
}

const PERIOD_LABEL: Record<Period, string> = {
  today: 'сегодня',
  yesterday: 'вчера',
  week: 'последние 7 дней',
  month: 'текущий месяц',
};

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-ink-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${accent || 'text-ink-900'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

function exportCsv(sales: Sale[], label: string) {
  const rows = [['Дата', 'Время', 'Номер', 'Товар', 'Добавки', 'Цена', 'Оплата', 'Кассир']];
  sales.forEach(s =>
    s.items.forEach(it =>
      rows.push([
        new Date(s.createdAt).toLocaleDateString('ru-RU'),
        formatTime(s.createdAt),
        orderNo(s.number),
        it.product.name,
        it.notes || '',
        String(Number(it.price)),
        s.paymentMethod === 'card' ? 'карта' : 'наличные',
        s.user?.name || s.user?.email || '',
      ])
    )
  );
  // «;» и BOM — чтобы Excel сразу открыл кириллицу по колонкам
  const csv = '﻿' + rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `продажи_${label.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SalesReport() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('today');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const [from, to] = periodRange(period);
    api
      .getSales(from, to)
      .then(setSales)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [period, toast]);

  const stats = useMemo(() => {
    const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
    // Себестоимость — по текущей карточке товара
    const cost = sales.reduce((s, x) => s + x.items.reduce((c, it) => c + Number(it.product.cost) * (it.quantity || 1), 0), 0);
    const items = sales.reduce((s, x) => s + x.items.length, 0);
    const cooked = sales.filter(s => s.readyAt);
    const avgCook = cooked.length
      ? cooked.reduce((s, x) => s + (new Date(x.readyAt!).getTime() - new Date(x.startedAt || x.createdAt).getTime()) / 1000, 0) / cooked.length
      : 0;
    const card = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + Number(x.total), 0);

    // По часам
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, orders: 0, revenue: 0 }));
    sales.forEach(s => {
      const h = new Date(s.createdAt).getHours();
      hours[h].orders++;
      hours[h].revenue += Number(s.total);
    });
    const used = hours.filter(x => x.orders);
    const hFrom = Math.min(9, ...used.map(x => x.h));
    const hTo = Math.max(22, ...used.map(x => x.h));
    const hourly = hours.slice(hFrom, hTo + 1);
    const peak = used.length ? used.reduce((a, b) => (b.orders > a.orders ? b : a)) : null;

    // По категориям и товарам
    const cats: Record<string, number> = {};
    const prods: Record<string, { name: string; category: string; count: number; revenue: number; cost: number }> = {};
    sales.forEach(s =>
      s.items.forEach(it => {
        const q = it.quantity || 1;
        cats[it.product.category] = (cats[it.product.category] || 0) + Number(it.price) * q;
        const p = (prods[it.product.name] ||= { name: it.product.name, category: it.product.category, count: 0, revenue: 0, cost: 0 });
        p.count += q;
        p.revenue += Number(it.price) * q;
        p.cost += Number(it.product.cost) * q;
      })
    );
    const categories = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const top = Object.values(prods).sort((a, b) => b.count - a.count);

    return { revenue, cost, profit: revenue - cost, items, avgCook, card, cash: revenue - card, hourly, peak, categories, top };
  }, [sales]);

  const avgCheck = sales.length ? stats.revenue / sales.length : 0;
  const maxHour = Math.max(1, ...stats.hourly.map(h => h.orders));
  const topMax = stats.top[0]?.count || 1;

  return (
    <div className="scroll-thin h-full overflow-y-auto p-5">
      <PageHeader
        title="Отчёты"
        subtitle={`Продажи за ${PERIOD_LABEL[period]}`}
        actions={
          <>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { id: 'today', label: 'Сегодня' },
                { id: 'yesterday', label: 'Вчера' },
                { id: 'week', label: '7 дней' },
                { id: 'month', label: 'Месяц' },
              ]}
            />
            <button
              onClick={() => exportCsv(sales, PERIOD_LABEL[period])}
              disabled={!sales.length}
              className="btn-outline h-10 px-3 text-sm"
              title="Выгрузить продажи в Excel (CSV)"
            >
              <Download size={16} />
              CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Выручка" value={rub(stats.revenue)} hint={`${sales.length} ${plural(sales.length, 'заказ', 'заказа', 'заказов')} · ${stats.items} шт`} />
        <Kpi
          label="Валовая прибыль"
          value={rub(stats.profit)}
          accent="text-emerald-600"
          hint={`маржа ${stats.revenue ? ((stats.profit / stats.revenue) * 100).toFixed(0) : 0}% · себестоимость ${rub(stats.cost)}`}
        />
        <Kpi label="Средний чек" value={rub(avgCheck)} hint={sales.length ? `${(stats.items / sales.length).toFixed(1)} позиции в заказе` : '—'} />
        <Kpi
          label="Среднее время готовки"
          value={stats.avgCook ? durationText(Math.round(stats.avgCook)) : '—'}
          accent={stats.avgCook > 600 ? 'text-red-600' : undefined}
          hint="от «Начать» до «Готово»"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        {/* ─── Нагрузка по часам ─── */}
        <section className="card p-5 xl:col-span-3">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold">Нагрузка по часам</h3>
              <p className="text-sm text-ink-500">
                {stats.peak ? (
                  <>
                    Пик — {stats.peak.h}:00–{stats.peak.h + 1}:00, {stats.peak.orders}{' '}
                    {plural(stats.peak.orders, 'заказ', 'заказа', 'заказов')} на {rub(stats.peak.revenue)}
                  </>
                ) : (
                  'Нет заказов за период'
                )}
              </p>
            </div>
          </div>
          <div className="flex h-48 items-end gap-1">
            {stats.hourly.map(h => {
              const isPeak = stats.peak?.h === h.h;
              return (
                <div key={h.h} className="group relative flex h-full flex-1 flex-col justify-end">
                  {h.orders > 0 && (
                    <span className="mb-1 text-center text-[11px] font-semibold tabular-nums text-ink-600">{h.orders}</span>
                  )}
                  <div
                    className={`rounded-t-md transition ${isPeak ? 'bg-brand-500' : h.orders ? 'bg-brand-300 group-hover:bg-brand-400' : 'bg-ink-100'}`}
                    style={{ height: h.orders ? `${Math.max(6, (h.orders / maxHour) * 85)}%` : '3px' }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    {h.h}:00 · {h.orders} зак. · {rub(h.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1 border-t border-ink-100 pt-1.5">
            {stats.hourly.map(h => (
              <span key={h.h} className="flex-1 text-center text-[11px] tabular-nums text-ink-400">
                {h.h % 2 === 0 ? h.h : ''}
              </span>
            ))}
          </div>
        </section>

        {/* ─── Структура выручки ─── */}
        <section className="card p-5 xl:col-span-2">
          <h3 className="font-bold">Структура выручки</h3>
          <p className="mb-4 text-sm text-ink-500">по категориям и способу оплаты</p>

          {stats.revenue > 0 ? (
            <>
              <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-ink-100">
                {stats.categories.map(([c, v]) => (
                  <div key={c} style={{ width: `${(v / stats.revenue) * 100}%`, background: categoryStyle(c).bar }} title={c} />
                ))}
              </div>
              <ul className="space-y-2 text-sm">
                {stats.categories.map(([c, v]) => (
                  <li key={c} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryStyle(c).bar }} />
                    <span className="flex-1 text-ink-700">{c}</span>
                    <span className="tabular-nums text-ink-500">{((v / stats.revenue) * 100).toFixed(0)}%</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{rub(v)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
                {([
                  ['Наличные', stats.cash, Banknote],
                  ['Карта / СБП', stats.card, CreditCard],
                ] as const).map(([l, v, Icon]) => (
                  <div key={l} className="rounded-xl bg-ink-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                      <Icon size={14} />
                      {l}
                    </div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{rub(v)}</div>
                    <div className="text-xs text-ink-400">{((v / stats.revenue) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-ink-400">Нет данных</div>
          )}
        </section>
      </div>

      {/* ─── Топ товаров ─── */}
      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h3 className="font-bold">Популярные товары</h3>
        </div>
        {stats.top.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-400">Нет продаж за период</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="w-10 px-5 py-2.5">#</th>
                <th className="px-3 py-2.5">Товар</th>
                <th className="w-1/3 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-right">Продано</th>
                <th className="px-3 py-2.5 text-right">Выручка</th>
                <th className="px-5 py-2.5 text-right">Прибыль</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {stats.top.slice(0, 10).map((p, i) => (
                <tr key={p.name}>
                  <td className="px-5 py-2.5 font-semibold tabular-nums text-ink-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-500">{p.category}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="h-2 rounded-full bg-ink-100">
                      <div className="h-2 rounded-full" style={{ width: `${(p.count / topMax) * 100}%`, background: categoryStyle(p.category).bar }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{num(p.count)} шт</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{rub(p.revenue)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-emerald-700">{rub(p.revenue - p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ─── Журнал заказов ─── */}
      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="font-bold">Журнал заказов</h3>
          <span className="text-sm text-ink-500">{sales.length}</span>
        </div>
        {!loading && sales.length === 0 ? (
          <Empty icon={ReceiptIcon} title="Заказов нет" hint="За выбранный период продаж не было" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {sales.map(s => {
              const open = expanded === s.id;
              const cook = s.readyAt
                ? durationText(Math.round((new Date(s.readyAt).getTime() - new Date(s.startedAt || s.createdAt).getTime()) / 1000))
                : null;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setExpanded(open ? null : s.id)}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-ink-50"
                  >
                    <span className="w-14 text-lg font-bold tabular-nums">{orderNo(s.number)}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{formatDateTime(s.createdAt)}</span>
                      <span className="block text-xs text-ink-500">
                        {s.user?.name || s.user?.email} · {s.items.length} {plural(s.items.length, 'позиция', 'позиции', 'позиций')}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      {s.closed ? (
                        <span className="chip bg-ink-100 text-ink-600">выдан{cook ? ` · ${cook}` : ''}</span>
                      ) : s.readyAt ? (
                        <span className="chip bg-emerald-100 text-emerald-800">готов</span>
                      ) : (
                        <span className="chip bg-amber-100 text-amber-800">в работе</span>
                      )}
                    </span>
                    <span className="text-ink-400" title={s.paymentMethod === 'card' ? 'Карта' : 'Наличные'}>
                      {s.paymentMethod === 'card' ? <CreditCard size={17} /> : <Banknote size={17} />}
                    </span>
                    <span className="w-24 text-right font-bold tabular-nums">{rub(s.total)}</span>
                    <ChevronDown size={18} className={`text-ink-400 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="bg-ink-50/70 px-5 py-3">
                      <table className="w-full text-sm">
                        <tbody>
                          {s.items.map(it => (
                            <tr key={it.id}>
                              <td className="py-1">
                                {it.product.name}
                                {it.notes && <span className="ml-2 text-brand-700">{it.notes}</span>}
                              </td>
                              <td className="py-1 text-right tabular-nums">{rub(it.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
