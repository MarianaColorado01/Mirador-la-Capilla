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

/** Fecha local en formato AAAA-MM-DD (la que entiende el servidor). */
export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type Period = 'hoy' | 'semana' | 'mes';

/** Rango de fechas para hoy, la semana (desde el lunes) o el mes en curso (RF-58). */
export function periodRange(p: Period, now = new Date()): { from: string; to: string } {
  const start = new Date(now);
  if (p === 'semana') start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  if (p === 'mes') start.setDate(1);
  return { from: isoDate(start), to: isoDate(now) };
}

/** "2026-11-09" → "09/11" */
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
