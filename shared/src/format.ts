/** 70800 → "$70.800" (sin depender de Intl, que Hermes no trae completo). */
export function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}$${String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** "2026-11-09T19:58:00Z" → "19:58" en hora local */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${clock(iso)}`;
}
