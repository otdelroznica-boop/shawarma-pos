import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, Package, PackagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, type Product } from '../api';
import { CATEGORIES, categoryStyle, sortByCategory } from '../lib/catalog';
import { num, rub } from '../lib/format';
import { Empty, Modal, PageHeader, Segmented, useToast } from './ui';

const emptyForm = { name: '', price: '', cost: '', stock: '', category: 'Шаурма' };
const LOW_STOCK = 10;

type View = 'active' | 'low' | 'archived';

export default function ProductsPage({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [view, setView] = useState<View>('active');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [adjust, setAdjust] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');
  const [adjustMode, setAdjustMode] = useState<'in' | 'out'>('in');

  const load = useCallback(() => api.getProducts(true).then(l => setProducts(sortByCategory(l))).catch(e => toast(e.message, 'error')), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (view === 'archived' ? !p.archived : p.archived) return false;
      if (view === 'low' && p.stock >= LOW_STOCK) return false;
      if (category !== 'Все' && p.category !== category) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [products, search, category, view]);

  const active = products.filter(p => !p.archived);
  const lowCount = active.filter(p => p.stock < LOW_STOCK).length;
  const stockValue = active.reduce((s, p) => s + Number(p.cost) * Math.max(0, p.stock), 0);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ name: p.name, price: String(Number(p.price)), cost: String(Number(p.cost)), stock: String(p.stock), category: p.category });
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      name: form.name,
      price: Number(form.price),
      cost: Number(form.cost),
      stock: Number(form.stock),
      category: form.category,
    };
    try {
      if (editId !== null) await api.updateProduct(editId, data);
      else await api.createProduct(data);
      toast(editId !== null ? 'Товар сохранён' : 'Товар добавлен');
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Удалить «${p.name}»?\nЕсли товар уже продавался, он уйдёт в архив, а продажи останутся в отчётах.`)) return;
    try {
      const r = await api.deleteProduct(p.id);
      toast(r.archived ? 'Товар убран в архив' : 'Товар удалён');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const restore = async (p: Product) => {
    await api.updateProduct(p.id, { archived: false }).catch(err => toast(err.message, 'error'));
    toast('Товар возвращён в продажу');
    load();
  };

  const applyAdjust = async () => {
    if (!adjust) return;
    const n = Number(delta);
    if (!n) return;
    try {
      await api.adjustStock(adjust.id, adjustMode === 'in' ? n : -n);
      toast(adjustMode === 'in' ? `Приход: +${n} шт` : `Списано: ${n} шт`);
      setAdjust(null);
      setDelta('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const margin = (p: Product) => (Number(p.price) > 0 ? ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 : 0);
  const preview = Number(form.price) - Number(form.cost);

  return (
    <div className="scroll-thin h-full overflow-y-auto p-5">
      <PageHeader
        title="Товары и остатки"
        subtitle={`${active.length} в продаже · остаток по себестоимости ${rub(stockValue)}`}
        actions={
          canEdit && (
            <button onClick={openNew} className="btn-primary h-10 px-4 text-sm">
              <Plus size={17} />
              Новый товар
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию" className="input h-10 pl-10" />
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: 'active', label: 'В продаже' },
            { id: 'low', label: `Заканчиваются${lowCount ? ` · ${lowCount}` : ''}` },
            { id: 'archived', label: 'Архив' },
          ]}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} className="input h-10 w-auto py-0">
          <option>Все</option>
          {CATEGORIES.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={Package} title="Товаров нет" hint={view === 'low' ? 'Остатков достаточно по всем позициям' : 'Измените фильтр или добавьте товар'} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3">Товар</th>
                <th className="px-3 py-3 text-right">Цена</th>
                <th className="px-3 py-3 text-right">Себестоимость</th>
                <th className="px-3 py-3 text-right">Наценка</th>
                <th className="px-3 py-3 text-right">Остаток</th>
                <th className="w-px px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {list.map(p => {
                const st = categoryStyle(p.category);
                const m = margin(p);
                return (
                  <tr key={p.id} className="group transition hover:bg-ink-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${st.tile}`}>
                          <st.icon size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900">{p.name}</div>
                          <div className="text-xs text-ink-500">{p.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{rub(p.price)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-500">{rub(p.cost)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-semibold tabular-nums text-ink-900">+{rub(Number(p.price) - Number(p.cost))}</div>
                      <div className={`text-xs tabular-nums ${m < 40 ? 'text-amber-600' : 'text-emerald-600'}`}>маржа {m.toFixed(0)}%</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`chip tabular-nums ${
                          p.stock <= 0 ? 'bg-red-100 text-red-700' : p.stock < LOW_STOCK ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-700'
                        }`}
                      >
                        {num(p.stock)} шт
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          {p.archived ? (
                            <button onClick={() => restore(p)} className="btn-ghost h-9 px-3 text-sm" title="Вернуть в продажу">
                              <ArchiveRestore size={16} />
                              Вернуть
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setAdjust(p);
                                  setAdjustMode('in');
                                  setDelta('');
                                }}
                                className="btn-ghost h-9 px-3 text-sm"
                                title="Приход или списание"
                              >
                                <PackagePlus size={16} />
                                Остаток
                              </button>
                              <button onClick={() => openEdit(p)} className="btn-ghost h-9 w-9" title="Изменить">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => remove(p)} className="btn-ghost h-9 w-9 hover:bg-red-50 hover:text-red-600" title="Удалить">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Карточка товара ─── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId !== null ? 'Изменить товар' : 'Новый товар'}
        width="max-w-md"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Название</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Шаурма сырная XL"
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Категория</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => {
                const st = categoryStyle(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      form.category === c ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    <st.icon size={15} />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ['price', 'Цена, ₽'],
              ['cost', 'Себест., ₽'],
              ['stock', 'Остаток, шт'],
            ] as const).map(([f, l]) => (
              <div key={f}>
                <label className="label">{l}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form[f]}
                  onChange={e => setForm({ ...form, [f]: e.target.value })}
                  className="input tabular-nums"
                  required
                />
              </div>
            ))}
          </div>
          {form.price && form.cost && (
            <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Наценка с одной штуки:{' '}
              <b className={preview < 0 ? 'text-red-600' : 'text-ink-900'}>{rub(preview)}</b>
              {Number(form.price) > 0 && <> · маржа {((preview / Number(form.price)) * 100).toFixed(0)}%</>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-outline h-11 flex-1">
              Отмена
            </button>
            <button type="submit" disabled={saving} className="btn-primary h-11 flex-1">
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Приход / списание ─── */}
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={adjust?.name} subtitle={adjust && `Сейчас на остатке: ${adjust.stock} шт`} width="max-w-sm">
        <div className="space-y-4">
          <Segmented
            value={adjustMode}
            onChange={setAdjustMode}
            options={[
              { id: 'in', label: 'Приход' },
              { id: 'out', label: 'Списание' },
            ]}
          />
          <div>
            <label className="label">Количество, шт</label>
            <input
              autoFocus
              inputMode="numeric"
              value={delta}
              onChange={e => setDelta(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && applyAdjust()}
              className="input h-12 text-xl font-bold tabular-nums"
            />
            {adjust && delta && (
              <div className="mt-2 text-sm text-ink-500">
                Станет: <b className="text-ink-900">{adjust.stock + (adjustMode === 'in' ? 1 : -1) * Number(delta)} шт</b>
              </div>
            )}
          </div>
          <button onClick={applyAdjust} disabled={!Number(delta)} className="btn-primary h-11 w-full">
            {adjustMode === 'in' ? 'Оприходовать' : 'Списать'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
