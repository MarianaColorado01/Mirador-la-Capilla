/* Cálculo del cobro — sección 4.3 del documento de requerimientos.
   Lo usan la app (para mostrarlo en vivo) y el servidor (que es quien decide). */

export interface BillInput {
  /** Σ cantidad × precio de los ítems no anulados */
  subtotal: number;
  /** Texto tal como lo escribe el usuario; vacío cuenta como 0 (RF-40) */
  discount: string;
  tipPercent: string;
  taxPercent: number;
  method: 'efectivo' | 'tarjeta' | 'transferencia';
  received?: string;
}

export interface BillResult {
  discount: number;
  tipPercent: number;
  base: number;
  tip: number;
  tax: number;
  total: number;
  change: number | null;
  errors: Partial<Record<'discount' | 'tipPercent' | 'received', string>>;
  ready: boolean;
}

/** "12.500" → 12500 ; "" → 0 ; "abc" → NaN */
export function parseAmount(text: string | undefined): number {
  const t = (text ?? '').trim();
  if (t === '') return 0;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function calculateBill(input: BillInput): BillResult {
  const errors: BillResult['errors'] = {};
  const d = parseAmount(input.discount);
  const t = parseAmount(input.tipPercent);

  if (Number.isNaN(d)) errors.discount = 'Escribe solo números.';
  else if (d < 0) errors.discount = 'El descuento no puede ser negativo.';
  else if (d > input.subtotal) errors.discount = 'El descuento no puede superar el subtotal.';

  if (Number.isNaN(t)) errors.tipPercent = 'Escribe solo números.';
  else if (t < 0 || t > 100) errors.tipPercent = 'La propina debe estar entre 0 % y 100 %.';

  const discount = errors.discount ? 0 : d;
  const tipPercent = errors.tipPercent ? 0 : t;
  const base = input.subtotal - discount;
  const tip = Math.round((base * tipPercent) / 100);
  const tax = Math.round((base * input.taxPercent) / 100);
  // Total = (subtotal − descuento) × (1 + (% propina + % impuesto) / 100)
  const total = Math.round(base * (1 + (tipPercent + input.taxPercent) / 100));

  let change: number | null = null;
  let receivedOk = true;
  if (input.method === 'efectivo') {
    const raw = (input.received ?? '').trim();
    const r = parseAmount(raw);
    if (raw === '') receivedOk = false;
    else if (Number.isNaN(r)) { errors.received = 'Escribe solo números.'; receivedOk = false; }
    else if (r < total) { errors.received = 'El monto recibido no cubre el total.'; receivedOk = false; }
    else change = r - total;
  }

  return { discount, tipPercent, base, tip, tax, total, change, errors, ready: Object.keys(errors).length === 0 && receivedOk };
}

/** Utilidad estimada = ventas − costo de lo vendido − otros gastos (el surtido no se resta). */
export function estimatedProfit(sales: number, costOfSales: number, otherExpenses: number): number {
  return sales - costOfSales - otherExpenses;
}
