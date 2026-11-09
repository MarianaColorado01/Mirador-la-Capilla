import { describe, expect, it } from 'vitest';
import { calculateBill, estimatedProfit } from './billing';

const base = { subtotal: 63000, taxPercent: 8, method: 'efectivo' as const };

describe('calculateBill (sección 4.3)', () => {
  it('aplica descuento, propina e impuesto sobre la base', () => {
    const r = calculateBill({ ...base, discount: '3.000', tipPercent: '10', received: '80.000' });
    expect(r.base).toBe(60000);
    expect(r.total).toBe(70800);
    expect(r.change).toBe(9200);
    expect(r.ready).toBe(true);
  });

  it('un campo vacío cuenta como 0', () => {
    const r = calculateBill({ ...base, discount: '', tipPercent: '', received: '70000' });
    expect(r.total).toBe(68040);
    expect(r.errors).toEqual({});
  });

  it('rechaza descuento negativo, mayor al subtotal o no numérico', () => {
    expect(calculateBill({ ...base, discount: '-1', tipPercent: '0' }).errors.discount).toMatch(/negativo/);
    expect(calculateBill({ ...base, discount: '70000', tipPercent: '0' }).errors.discount).toMatch(/superar/);
    expect(calculateBill({ ...base, discount: 'abc', tipPercent: '0' }).errors.discount).toMatch(/números/);
  });

  it('la propina debe estar entre 0 y 100', () => {
    expect(calculateBill({ ...base, discount: '0', tipPercent: '120' }).errors.tipPercent).toBeDefined();
  });

  it('en efectivo el recibido no puede ser menor que el total', () => {
    const r = calculateBill({ ...base, discount: '0', tipPercent: '0', received: '50000' });
    expect(r.errors.received).toBeDefined();
    expect(r.ready).toBe(false);
  });

  it('con tarjeta no pide monto recibido', () => {
    expect(calculateBill({ ...base, method: 'tarjeta', discount: '0', tipPercent: '10' }).ready).toBe(true);
  });
});

it('utilidad estimada del ejemplo del documento', () => {
  expect(estimatedProfit(1250000, 620000, 40000)).toBe(590000);
});
