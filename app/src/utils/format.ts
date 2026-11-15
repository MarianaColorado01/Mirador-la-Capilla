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

/** Minutos completos desde la fecha dada. */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${clock(iso)}`;
}
