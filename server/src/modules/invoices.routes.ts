import { Router } from 'express';
import type { DB } from '../db/index';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';
import { iso, loadInvoice } from '../services/views';

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

  return r;
}
