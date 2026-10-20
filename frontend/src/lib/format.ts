const rubFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** 1250 → «1 250 ₽» */
export const rub = (v: number | string | null | undefined) => `${rubFmt.format(Number(v) || 0)} ₽`;

export const num = (v: number | string | null | undefined) => rubFmt.format(Number(v) || 0);

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatDateTime = (iso: string) => `${formatDate(iso)} ${formatTime(iso)}`;

export const secondsSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));

/** 125 → «2:05» */
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const durationText = (sec: number) => {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} мин ${sec % 60 ? `${sec % 60} с` : ''}`.trim();
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** Номер заказа для гостя: 7 → «007» */
export const orderNo = (n: number) => String(n || 0).padStart(3, '0');
