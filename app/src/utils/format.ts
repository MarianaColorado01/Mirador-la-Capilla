import type { Period } from '@mirador/shared';

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

/** Selector Hoy / 7 días / Mes de Gastos y Resumen (RF-57, RF-58); el rango sale de `periodRange`. */
export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: 'Mes' },
];
export const PERIOD_TEXT: Record<Period, string> = { hoy: 'hoy', semana: 'últimos 7 días', mes: 'este mes' };
