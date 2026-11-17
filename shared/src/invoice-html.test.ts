import { describe, expect, it } from 'vitest';
import { invoiceHtml } from './invoice-html';
import type { Invoice } from './types';

const invoice: Invoice = {
  id: 1, number: 42, accountId: 1, tableNumber: 3, waiter: 'Ana <b>', cashier: 'Luis',
  subtotal: 63000, discount: 3000, tipPercent: 10, tip: 6000, taxPercent: 8, tax: 4800, total: 70800,
  method: 'efectivo', payments: [{ method: 'efectivo', amount: 70800, received: 80000, change: 9200 }],
  createdAt: '2026-11-09T19:58:00Z', voided: null,
  items: [
    { id: 1, productId: 1, productName: 'Club Colombia', qty: 3, unitPrice: 21000, note: '<script>alert(1)</script>', voided: null },
    { id: 2, productId: 2, productName: 'Aguardiente', qty: 1, unitPrice: 9000, note: null, voided: { by: 'Ana', at: '2026-11-09T19:00:00Z', reason: 'Error & prisa', restocked: true } },
  ],
};

describe('invoiceHtml (RF-45)', () => {
  it('escapa el texto de usuario', () => {
    const html = invoiceHtml(invoice, 'Bar "X"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Ana &lt;b&gt;');
    expect(html).toContain('Bar &quot;X&quot;');
    expect(html).toContain('Error &amp; prisa');
  });

  it('formatea número, totales y pagos', () => {
    const html = invoiceHtml(invoice, 'Mirador');
    expect(html).toContain('000042');
    for (const s of ['$63.000', '−$3.000', 'Propina 10 %', 'Impuesto 8 %', '$70.800', '$80.000', '$9.200']) expect(html).toContain(s);
    expect(html).toContain('class="voided"');
    expect(html).not.toContain('ANULADA');
  });

  it('marca la factura anulada con su motivo', () => {
    const html = invoiceHtml({ ...invoice, voided: { at: '2026-11-10T10:00:00Z', by: 'Dueño', reason: 'Cobro <doble>' } }, 'Mirador');
    expect(html).toContain('ANULADA');
    expect(html).toContain('Motivo: Cobro &lt;doble&gt;');
  });
});
