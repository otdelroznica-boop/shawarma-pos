import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api, type User } from '../api';
import { Empty, Modal, PageHeader, Segmented, useToast } from './ui';

const emptyForm = { name: '', email: '', password: '', role: 'cashier' as User['role'] };

export default function StaffPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.getUsers().then(setUsers).catch(e => toast(e.message, 'error')), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.register(form);
      toast('Сотрудник добавлен');
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto p-5">
      <PageHeader
        title="Сотрудники"
        subtitle="Кассиры принимают заказы и работают на кухне. Администратор дополнительно меняет товары и добавляет сотрудников"
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary h-10 px-4 text-sm">
            <Plus size={17} />
            Добавить
          </button>
        }
      />

      <div className="card max-w-3xl overflow-hidden">
        {users.length === 0 ? (
          <Empty icon={Users} title="Нет сотрудников" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {users.map(u => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 font-bold uppercase text-ink-600">
                  {(u.name || u.email).slice(0, 1)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{u.name || u.email.split('@')[0]}</div>
                  <div className="text-sm text-ink-500">{u.email}</div>
                </div>
                <span className={`chip ${u.role === 'admin' ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'}`}>
                  {u.role === 'admin' ? 'администратор' : 'кассир'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый сотрудник" width="max-w-md">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Имя</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="Анна" />
          </div>
          <div>
            <label className="label">Email для входа</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input
              type="text"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="input"
              minLength={6}
              placeholder="не короче 6 символов"
              required
            />
          </div>
          <div>
            <label className="label">Роль</label>
            <Segmented
              value={form.role}
              onChange={role => setForm({ ...form, role })}
              options={[
                { id: 'cashier', label: 'Кассир' },
                { id: 'admin', label: 'Администратор' },
              ]}
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary h-11 w-full">
            {saving ? 'Сохраняем…' : 'Добавить сотрудника'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
