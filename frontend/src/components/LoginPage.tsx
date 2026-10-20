import React, { useState } from 'react';
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api, IS_DEMO, type User } from '../api';
import { DEMO_ACCOUNTS } from '../demo/mockApi';

interface Props {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: Props) {
  // В режиме разработки подставляем учётку из сида, в сборке — пустые поля
  const [email, setEmail] = useState(IS_DEMO ? DEMO_ACCOUNTS[0].email : import.meta.env.DEV ? 'admin@example.com' : '');
  const [password, setPassword] = useState(IS_DEMO ? DEMO_ACCOUNTS[0].password : import.meta.env.DEV ? 'admin123' : '');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(email, password);
      localStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Левая панель — бренд */}
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f76510 0%, transparent 65%)' }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-xl font-black">Ш</div>
          <span className="text-lg font-bold">Шаурма POS</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Касса, кухня и табло
            <br />
            <span className="text-brand-400">в одном окне</span>
          </h1>
          <p className="mt-4 text-ink-300">
            Принимайте заказы в пару касаний, следите за готовкой по таймеру и показывайте гостям номер, когда шаурма готова.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[
              ['Касса', 'наличные и карта, сдача'],
              ['Кухня', 'таймер и отметки'],
              ['Табло', 'номера для гостей'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold">{t}</div>
                <div className="mt-0.5 text-xs text-ink-400">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-ink-500">Версия 2.0</div>
      </div>

      {/* Правая панель — форма */}
      <div className="flex items-center justify-center bg-ink-50 p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-xl font-black text-white">Ш</div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Вход в смену</h2>
          <p className="mt-1 text-sm text-ink-500">Введите рабочий email и пароль</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input px-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700"
                  aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <CircleAlert size={18} className="mt-px shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-base">
              {loading ? 'Входим…' : 'Войти'}
              {!loading && <ArrowRight size={18} />}
            </button>

            {IS_DEMO && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
                <div className="font-semibold text-brand-900">Демо-версия</div>
                <p className="mt-1 text-brand-800">
                  Работает без сервера: данные хранятся только в вашем браузере. Войти можно под любой ролью, пароль demo123.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map(a => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword(a.password);
                      }}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        email === a.email ? 'border-brand-500 bg-white' : 'border-brand-200 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="font-semibold text-ink-900">{a.label}</div>
                      <div className="text-xs text-ink-500">{a.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
