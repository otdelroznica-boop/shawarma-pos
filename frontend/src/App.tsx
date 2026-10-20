import React, { useEffect, useState } from 'react';
import {
  ChartColumn,
  ChefHat,
  LogOut,
  MonitorPlay,
  Package,
  ShoppingBasket,
  Users,
  type LucideIcon,
} from 'lucide-react';
import LoginPage from './components/LoginPage';
import CashierScreen from './components/CashierScreen';
import ProductsPage from './components/ProductsPage';
import SalesReport from './components/SalesReport';
import QueuePage from './components/QueuePage';
import BoardScreen from './components/BoardScreen';
import StaffPage from './components/StaffPage';
import { ToastProvider } from './components/ui';
import { resetDemo } from './demo/mockApi';
import { api, IS_DEMO, clearSession, getStoredUser, getToken, UNAUTHORIZED_EVENT, type User } from './api';

type Page = 'cashier' | 'queue' | 'products' | 'reports' | 'staff';

const PAGE_KEY = 'pos:page';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Shell() {
  const [user, setUser] = useState<User | null>(getToken() ? getStoredUser() : null);
  const [page, setPage] = useState<Page>(() => (localStorage.getItem(PAGE_KEY) as Page) || 'cashier');
  const [queueCount, setQueueCount] = useState(0);
  const now = useClock();

  const go = (p: Page) => {
    setPage(p);
    localStorage.setItem(PAGE_KEY, p);
  };

  // Токен истёк / отозван — возвращаем на вход
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Освежаем профиль (роль могла поменяться)
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(u => {
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      })
      .catch(() => {});
  }, []);

  // Счётчик активных заказов для бейджа в меню
  useEffect(() => {
    if (!user) return;
    const tick = () => api.getQueue().then(q => setQueueCount(q.length)).catch(() => {});
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [user]);

  if (!user) {
    return (
      <LoginPage
        onLogin={u => {
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        }}
      />
    );
  }

  const isAdmin = user.role === 'admin';
  const nav: { id: Page; label: string; icon: LucideIcon; badge?: number; admin?: boolean }[] = [
    { id: 'cashier', label: 'Касса', icon: ShoppingBasket },
    { id: 'queue', label: 'Кухня', icon: ChefHat, badge: queueCount },
    { id: 'products', label: 'Товары', icon: Package },
    { id: 'reports', label: 'Отчёты', icon: ChartColumn },
    { id: 'staff', label: 'Сотрудники', icon: Users, admin: true },
  ];
  const current = nav.find(n => n.id === page && (!n.admin || isAdmin)) ? page : 'cashier';

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const displayName = user.name || user.email.split('@')[0];

  return (
    <div className="flex h-full">
      {/* ─── Боковое меню ─── */}
      <aside className="flex w-[88px] shrink-0 flex-col items-center bg-ink-950 py-4 text-ink-300 xl:w-56 xl:items-stretch xl:px-3">
        <div className="mb-6 flex items-center gap-2.5 xl:px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-black text-white">
            Ш
          </div>
          <div className="hidden leading-tight xl:block">
            <div className="text-[15px] font-bold text-white">Шаурма POS</div>
            <div className="text-xs text-ink-400">точка продаж</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav
            .filter(n => !n.admin || isAdmin)
            .map(n => {
              const active = current === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition xl:flex-row xl:gap-3 xl:px-3 xl:text-sm ${
                    active ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 hidden w-1 rounded-r bg-brand-500 xl:block" />}
                  <n.icon size={21} className={active ? 'text-brand-400' : ''} />
                  <span>{n.label}</span>
                  {!!n.badge && (
                    <span className="absolute right-2 top-1.5 min-w-[20px] rounded-full bg-brand-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white xl:static xl:ml-auto">
                      {n.badge}
                    </span>
                  )}
                </button>
              );
            })}

          <a
            href="#board"
            target="_blank"
            rel="noreferrer"
            title="Открыть табло для гостей в новом окне (на второй монитор)"
            className="mt-2 flex flex-col items-center gap-1 rounded-xl border border-dashed border-white/15 px-2 py-2.5 text-[11px] font-semibold transition hover:border-white/30 hover:text-white xl:flex-row xl:gap-3 xl:px-3 xl:text-sm"
          >
            <MonitorPlay size={21} />
            <span>Табло</span>
          </a>
        </nav>

        {IS_DEMO && (
          <button
            onClick={() => confirm('Сбросить демо? Все заказы и изменения в этом браузере удалятся.') && resetDemo()}
            title="Вернуть демо-данные в исходное состояние"
            className="mt-2 rounded-xl bg-brand-500/15 px-2 py-2 text-center text-[11px] font-semibold text-brand-300 transition hover:bg-brand-500/25 xl:text-left xl:text-xs"
          >
            Демо-режим
            <span className="block font-normal text-brand-200/70">сбросить данные</span>
          </button>
        )}

        <div className="mt-4 border-t border-white/10 pt-4 xl:px-1">
          <div className="mb-3 hidden text-center xl:block xl:text-left">
            <div className="text-2xl font-bold tabular-nums text-white">
              {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-ink-400 first-letter:uppercase">
              {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="flex items-center gap-2.5 xl:px-1">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-800 text-sm font-bold uppercase text-white xl:flex">
              {displayName.slice(0, 1)}
            </div>
            <div className="hidden min-w-0 flex-1 leading-tight xl:block">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              <div className="text-xs text-ink-400">{isAdmin ? 'администратор' : 'кассир'}</div>
            </div>
            <button
              onClick={logout}
              title="Выйти"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Рабочая область ─── */}
      <main className="min-w-0 flex-1 overflow-hidden">
        {current === 'cashier' && <CashierScreen onGoToQueue={() => go('queue')} />}
        {current === 'queue' && <QueuePage onQueueCountChange={setQueueCount} />}
        {current === 'products' && <ProductsPage canEdit={isAdmin} />}
        {current === 'reports' && <SalesReport />}
        {current === 'staff' && <StaffPage />}
      </main>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash === '#board') return <BoardScreen />;

  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
