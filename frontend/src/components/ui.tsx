import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CircleAlert, Check, X } from 'lucide-react';

// ─── Модальное окно ──────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, subtitle, width = 'max-w-lg', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`card flex max-h-[92vh] w-full ${width} animate-pop-in flex-col overflow-hidden shadow-2xl`}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight text-ink-900">{title}</h3>
              {subtitle && <div className="mt-0.5 text-sm text-ink-500">{subtitle}</div>}
            </div>
            <button onClick={onClose} className="btn-ghost -mr-2 h-9 w-9 shrink-0 rounded-full" aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-ink-100 bg-ink-50/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Уведомления ─────────────────────────────────────────────────────────────
type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'error' ? 5000 : 2800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm animate-slide-up items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lift ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-ink-900 text-white'
            }`}
          >
            {t.kind === 'error' ? (
              <CircleAlert size={18} className="mt-px shrink-0" />
            ) : (
              <Check size={18} className="mt-px shrink-0 text-emerald-400" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ─── Пустое состояние ────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
        <Icon size={26} />
      </div>
      <div className="font-semibold text-ink-800">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-sm text-ink-500">{hint}</div>}
    </div>
  );
}

// ─── Заголовок страницы ──────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Сегментированный переключатель ─────────────────────────────────────────
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-card">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            value === o.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
