import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';
import { iso, loadInvoice } from '../services/views';

const VoidBody = z.object({ reason: z.string().trim().min(3, 'Escribe el motivo de la anulación').max(200, 'El motivo admite hasta 200 caracteres') });

export function invoiceRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth, requireRole('caja', 'todo'));

  // RF-43: historial con búsqueda por número o fecha (YYYY-MM-DD)
  r.get('/', route((req, res) => {
    const q = String(req.query.q ?? '').trim();
    const byNumber = /^\d+$/.test(q) ? Number(q) : null;
    const byDate = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null;
    const rows = db.prepare(`SELECT inv.id, inv.number, inv.total, inv.created_at, inv.voided_at, t.number AS table_number, p.method
      FROM invoices inv JOIN accounts a ON a.id = inv.account_id JOIN tables t ON t.id = a.table_id
      LEFT JOIN payments p ON p.invoice_id = inv.id
      WHERE (@n IS NULL OR inv.number = @n) AND (@d IS NULL OR date(inv.created_at, 'localtime') = @d)
      ORDER BY inv.number DESC LIMIT 100`).all({ n: byNumber, d: byDate }) as
      { id: number; number: number; total: number; created_at: string; voided_at: string | null; table_number: number; method: string }[];
    res.json(rows.map((v) => ({ id: v.id, number: v.number, total: v.total, createdAt: iso(v.created_at), voided: !!v.voided_at, tableNumber: v.table_number, method: v.method })));
  }));

  r.get('/:id', route((req, res) => {
    const inv = loadInvoice(db, Number(req.params.id));
    if (!inv) throw httpError(404, 'Factura no encontrada');
    res.json(inv);
  }));

  // RF-44 (tabla 4.2, cuenta pagada): solo el dueño anula. Lo vendido no anulado vuelve al stock
  // con un ajuste que referencia la factura. El número no se reutiliza (RN-06) y la cuenta sigue
  // pagada con su factura anulada: la mesa no se reabre.
  r.post('/:id/void', requireRole(), route((req, res) => {
    const { reason } = VoidBody.parse(req.body);
    const id = Number(req.params.id);
    db.transaction(() => {
      const inv = db.prepare('SELECT id, number, account_id, voided_at FROM invoices WHERE id = ?').get(id) as
        | { id: number; number: number; account_id: number; voided_at: string | null }
        | undefined;
      if (!inv) throw httpError(404, 'Factura no encontrada');
      if (inv.voided_at) throw httpError(409, 'La factura ya estaba anulada');
      const sold = db.prepare(`SELECT i.product_id, SUM(i.qty) AS qty FROM round_items i JOIN rounds rr ON rr.id = i.round_id
        WHERE rr.account_id = ? AND i.voided_at IS NULL GROUP BY i.product_id`).all(inv.account_id) as { product_id: number; qty: number }[];
      const move = db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'ajuste', ?, ?, ?, ?)");
      for (const s of sold) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(s.qty, s.product_id); // RN-02
        move.run(s.product_id, s.qty, `Anulación de factura: ${reason}`, `factura:${inv.number}`, req.user!.id);
      }
      db.prepare("UPDATE invoices SET voided_at = datetime('now'), voided_by = ?, void_reason = ? WHERE id = ?").run(req.user!.id, reason, inv.id);
      audit(db, req.user!.id, 'anular', 'factura', inv.id, { number: inv.number, reason, restocked: sold });
    })();
    res.json(loadInvoice(db, id));
  }));

  return r;
}
