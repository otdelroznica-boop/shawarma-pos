import React, { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { api, getToken, type BoardEntry } from '../api';
import { orderNo } from '../lib/format';

/**
 * Табло для гостей: слева номера «готовится», справа крупно «можно забирать».
 * Открывается по адресу /#board на втором мониторе. Нужен вход на этом же компьютере.
 */
export default function BoardScreen() {
  const [preparing, setPreparing] = useState<BoardEntry[]>([]);
  const [ready, setReady] = useState<BoardEntry[]>([]);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const lastReady = useRef<Set<number>>(new Set());
  const [justReady, setJustReady] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!getToken()) {
      setError('Сначала войдите в кассу на этом компьютере, затем обновите табло');
      return;
    }
    const load = async () => {
      try {
        const b = await api.getBoard();
        const newly = b.ready.filter(r => !lastReady.current.has(r.id)).map(r => r.id);
        if (lastReady.current.size && newly.length) {
          setJustReady(new Set(newly));
          setTimeout(() => setJustReady(new Set()), 6000);
        }
        lastReady.current = new Set(b.ready.map(r => r.id));
        setPreparing(b.preparing);
        setReady(b.ready);
        setError('');
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
    const t = setInterval(load, 3000);
    const c = setInterval(() => setNow(new Date()), 15000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl font-black">Ш</div>
          <div className="text-3xl font-bold tracking-tight">Ваш заказ</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-4xl font-bold tabular-nums text-ink-300">
            {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="rounded-xl p-3 text-ink-500 transition hover:bg-white/10 hover:text-white"
            title="Во весь экран"
          >
            <Maximize2 size={22} />
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-10 text-center text-2xl text-ink-400">{error}</div>
      ) : (
        <div className="grid flex-1 grid-cols-[1fr_1.4fr] gap-6 px-10 pb-10">
          <section className="flex flex-col rounded-3xl bg-white/5 p-8">
            <h2 className="mb-6 text-2xl font-semibold uppercase tracking-widest text-ink-400">Готовится</h2>
            <div className="grid grid-cols-3 content-start gap-4">
              {preparing.map(p => (
                <div key={p.id} className="rounded-2xl bg-white/5 py-4 text-center text-5xl font-bold tabular-nums text-ink-200">
                  {orderNo(p.number)}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col rounded-3xl bg-emerald-500/10 p-8 ring-1 ring-emerald-400/30">
            <h2 className="mb-6 text-2xl font-semibold uppercase tracking-widest text-emerald-400">Можно забирать</h2>
            {ready.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-2xl text-ink-500">Скоро здесь появится ваш номер</div>
            ) : (
              <div className="grid grid-cols-2 content-start gap-5 xl:grid-cols-3">
                {ready.map(r => (
                  <div
                    key={r.id}
                    className={`rounded-3xl py-6 text-center text-8xl font-black tabular-nums transition ${
                      justReady.has(r.id) ? 'animate-pulse bg-emerald-400 text-ink-950' : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {orderNo(r.number)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
