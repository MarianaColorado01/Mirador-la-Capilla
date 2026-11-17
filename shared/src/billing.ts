/* Cálculo del cobro — sección 4.3 del documento de requerimientos.
   Lo usan la app (para mostrarlo en vivo) y el servidor (que es quien decide). */
import type { InvoicePayment, PaymentMethod } from './types';

export interface BillInput {
  /** Σ cantidad × precio de los ítems no anulados */
  subtotal: number;
  /** Texto tal como lo escribe el usuario; vacío cuenta como 0 (RF-40) */
  discount: string;
  tipPercent: string;
  taxPercent: number;
  /** Sin método (pago dividido, RF-46) no se valida el recibido: lo hace `splitPayments`. */
  method?: PaymentMethod;
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
  // Total = (subtotal − descuento) × (1 + (% propina + % impuesto) / 100), sumando las partes ya
  // redondeadas para que la factura cuadre al peso.
  const total = base + tip + tax;

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

export interface PaymentInput {
  method: PaymentMethod;
  amount: string;
  received?: string;
}

export interface SplitResult {
  payments: InvoicePayment[];
  /** total − Σ montos válidos: > 0 falta, < 0 sobra */
  remaining: number;
  /** Claves `payments.N.amount`, `payments.N.received` y `payments` (la suma no cuadra). */
  errors: Record<string, string>;
  ready: boolean;
}

/** RF-46: varios pagos para una misma factura. La suma debe ser exactamente el total y en
    efectivo el cambio se calcula por pago. */
export function splitPayments(total: number, inputs: PaymentInput[]): SplitResult {
  const errors: Record<string, string> = {};
  let covered = 0;
  const payments = inputs.map((p, i): InvoicePayment => {
    const amount = parseAmount(p.amount);
    const amountOk = Number.isInteger(amount) && amount > 0;
    if ((p.amount ?? '').trim() === '') errors[`payments.${i}.amount`] = 'Escribe el monto.';
    else if (!amountOk) errors[`payments.${i}.amount`] = 'El monto debe ser un número entero mayor que 0.';
    else covered += amount;
    if (p.method !== 'efectivo') return { method: p.method, amount, received: null, change: null };
    const raw = (p.received ?? '').trim();
    const r = parseAmount(raw);
    if (raw === '') errors[`payments.${i}.received`] = 'Escribe el monto recibido.';
    else if (Number.isNaN(r)) errors[`payments.${i}.received`] = 'Escribe solo números.';
    else if (amountOk && r < amount) errors[`payments.${i}.received`] = 'El recibido no cubre este pago.';
    return { method: p.method, amount, received: r, change: amountOk && r >= amount ? r - amount : null };
  });
  const remaining = total - covered;
  if (inputs.length === 0) errors.payments = 'Agrega al menos un pago.';
  else if (Object.keys(errors).length === 0 && remaining !== 0)
    errors.payments = remaining > 0 ? 'Los pagos no cubren el total.' : 'Los pagos superan el total.';
  return { payments, remaining, errors, ready: Object.keys(errors).length === 0 };
}

/** Reparte el total en n partes enteras iguales; la última absorbe el redondeo. */
export function equalShares(total: number, n: number): number[] {
  const part = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - part * (n - 1) : part));
}

/** Utilidad estimada = ventas − costo de lo vendido − otros gastos (el surtido no se resta). */
export function estimatedProfit(sales: number, costOfSales: number, otherExpenses: number): number {
  return sales - costOfSales - otherExpenses;
}
