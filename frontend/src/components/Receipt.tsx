import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type Sale } from '../api';
import { formatDateTime, num, orderNo } from '../lib/format';

/**
 * Чек / стикер для термопринтера 58–80 мм. Невидим на экране, печатается через window.print().
 * kind="receipt" — чек гостю (цены, оплата, сдача), kind="sticker" — стикер на пакет для кухни.
 */
export function Receipt({ sale, kind }: { sale: Sale; kind: 'receipt' | 'sticker' }) {
  const change = sale.paymentMethod === 'cash' && sale.cashReceived != null ? Number(sale.cashReceived) - Number(sale.total) : null;

  return createPortal(
    <div className="print-area hidden p-2 font-mono text-[12px] leading-snug text-black print:block">
      <div className="border-b border-dashed border-black pb-2 text-center">
        <div className="text-[13px] font-bold">ШАУРМА POS</div>
        <div className="my-1 text-[11px]">ЗАКАЗ</div>
        <div className="text-[34px] font-black leading-none">{orderNo(sale.number)}</div>
        <div className="mt-1 text-[11px]">{formatDateTime(sale.createdAt)}</div>
      </div>

      <div className="py-2">
        {sale.items.map((item, i) => (
          <div key={item.id ?? i} className="border-b border-dotted border-black/50 py-1">
            <div className="flex justify-between gap-2 font-bold">
              <span>
                {kind === 'sticker' ? '[ ] ' : ''}
                {item.product.name}
              </span>
              {kind === 'receipt' && <span className="whitespace-nowrap">{num(item.price)}</span>}
            </div>
            {item.notes && <div className="pl-3 text-[11px]">{item.notes}</div>}
          </div>
        ))}
      </div>

      {kind === 'receipt' && (
        <div className="border-t border-black pt-1">
          <div className="flex justify-between text-[15px] font-black">
            <span>ИТОГО</span>
            <span>{num(sale.total)} руб.</span>
          </div>
          <div className="flex justify-between">
            <span>Оплата</span>
            <span>{sale.paymentMethod === 'card' ? 'картой' : 'наличными'}</span>
          </div>
          {change != null && (
            <>
              <div className="flex justify-between">
                <span>Внесено</span>
                <span>{num(sale.cashReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span>Сдача</span>
                <span>{num(change)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 text-center text-[11px]">
        {kind === 'receipt' ? 'Назовите номер заказа при выдаче. Приятного аппетита!' : `Позиций: ${sale.items.length}`}
      </div>
    </div>,
    document.body
  );
}

/** Отрисовать чек и сразу отправить на печать */
export function usePrint(sale: Sale | null, onDone: () => void) {
  useEffect(() => {
    if (!sale) return;
    const t = setTimeout(() => {
      window.print();
      onDone();
    }, 80);
    return () => clearTimeout(t);
  }, [sale, onDone]);
}
