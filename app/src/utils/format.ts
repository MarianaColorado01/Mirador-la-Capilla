import type { Period } from '@mirador/shared';

// Compartidos con el HTML de la factura (RF-45).
export { clock, dateTime, money, pad } from '@mirador/shared';

/** Minutos completos desde la fecha dada. */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Selector Hoy / 7 días / Mes de Gastos y Resumen (RF-57, RF-58); el rango sale de `periodRange`. */
export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: 'Mes' },
];
export const PERIOD_TEXT: Record<Period, string> = { hoy: 'hoy', semana: 'últimos 7 días', mes: 'este mes' };
