import { dateTime, money, pad } from './format';
import type { Invoice, InvoiceMethod } from './types';

export const METHOD_LABEL: Record<InvoiceMethod, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Pago dividido' };

/** Escapa texto de usuario (nombres, notas, motivos) para que no se interprete como HTML. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const row = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="r">${value}</td></tr>`;

/**
 * RF-45: HTML autocontenido de la factura para `expo-print` (sin recursos externos: la caja
 * puede no tener internet). Hoja A4 con una columna angosta tipo tirilla.
 */
export function invoiceHtml(v: Invoice, businessName: string): string {
  const e = escapeHtml;
  const items = v.items
    .map((i) => {
      const note = i.note ? `<div class="note">${e(i.note)}</div>` : '';
      const voided = i.voided ? `<div class="note">ANULADO · ${e(i.voided.reason)}</div>` : '';
      return `<tr class="${i.voided ? 'voided' : ''}"><td>${i.qty} × ${e(i.productName)}${note}${voided}</td><td class="r">${money(i.qty * i.unitPrice)}</td></tr>`;
    })
    .join('');
  const payments = v.payments
    .map((p, n) =>
      [
        row(e(v.payments.length > 1 ? `Pago ${n + 1} · ${METHOD_LABEL[p.method]}` : `Pagado · ${METHOD_LABEL[p.method]}`), money(p.amount)),
        p.received != null ? row('Recibido', money(p.received)) : '',
        p.change != null ? row('Cambio', money(p.change)) : '',
      ].join(''),
    )
    .join('');
  const voidMark = v.voided
    ? `<div class="stamp">ANULADA</div><p class="c">${e(v.voided.by)} · ${dateTime(v.voided.at)}<br>Motivo: ${e(v.voided.reason)}</p>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { margin: 24px; }
body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 13px; }
.t { max-width: 360px; margin: 0 auto; }
h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; vertical-align: top; }
table { width: 100%; border-collapse: collapse; } td { padding: 3px 0; }
hr { border: 0; border-top: 1px dashed #888; margin: 8px 0; }
.note { font-size: 11px; color: #555; }
.voided td { text-decoration: line-through; color: #888; }
.total td { font-size: 16px; font-weight: bold; border-top: 1px solid #111; padding-top: 6px; }
.stamp { border: 4px solid #c00; color: #c00; font-size: 40px; font-weight: bold; text-align: center; letter-spacing: 6px; margin: 12px 0 4px; padding: 6px; transform: rotate(-6deg); }
</style></head><body><div class="t">
<h1>${e(businessName)}</h1>
<p class="c">Factura N.º <b>${pad(v.number, 6)}</b><br>${dateTime(v.createdAt)}</p>
${voidMark}
<table>${row('Mesa', pad(v.tableNumber))}${row('Mesero', e(v.waiter))}${row('Cajero', e(v.cashier))}</table>
<hr><table>${items}</table><hr>
<table>
${row('Subtotal', money(v.subtotal))}
${v.discount > 0 ? row('Descuento', money(-v.discount)) : ''}
${row(`Propina ${v.tipPercent} %`, money(v.tip))}
${row(`Impuesto ${v.taxPercent} %`, money(v.tax))}
${row('Total', money(v.total), 'total')}
</table><hr>
<table>${payments}</table>
<p class="c note">Numeración consecutiva. Gracias por su visita.</p>
</div></body></html>`;
}
