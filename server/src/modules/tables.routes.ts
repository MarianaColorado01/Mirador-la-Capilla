import { Router } from 'express';
import type { TableSummary } from '@mirador/shared';
import type { DB } from '../db/index';
import { requireAuth } from '../lib/auth';
import { route } from '../lib/http';
import { iso } from '../services/views';

interface Row {
  number: number; zone: string | null; account_id: number | null; status: 'abierta' | 'por_cobrar' | null;
  waiter: string | null; waiter_id: number | null; opened_at: string | null; subtotal: number | null; ready: number | null;
}

export function tableRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db));

  // RF-16: mapa de mesas con su estado
  r.get('/', route((_req, res) => {
    const rows = db.prepare(`SELECT t.number, t.zone, a.id AS account_id, a.status, u.name AS waiter, a.waiter_id, a.opened_at,
        (SELECT COALESCE(SUM(i.qty * i.unit_price), 0) FROM round_items i JOIN rounds rr ON rr.id = i.round_id
          WHERE rr.account_id = a.id AND i.voided_at IS NULL) AS subtotal,
        (SELECT COUNT(*) FROM rounds rr WHERE rr.account_id = a.id AND rr.status = 'listo') AS ready
      FROM tables t
      LEFT JOIN accounts a ON a.table_id = t.id AND a.status IN ('abierta', 'por_cobrar')
      LEFT JOIN users u ON u.id = a.waiter_id
      WHERE t.active = 1 ORDER BY t.number`).all() as Row[];
    const out: TableSummary[] = rows.map((t) => ({
      number: t.number,
      zone: t.zone,
      status: !t.account_id ? 'libre' : t.status === 'por_cobrar' ? 'por_cobrar' : 'ocupada',
      account: t.account_id
        ? { id: t.account_id, waiter: t.waiter!, waiterId: t.waiter_id!, subtotal: t.subtotal ?? 0, openedAt: iso(t.opened_at!), readyRounds: t.ready ?? 0 }
        : null,
    }));
    res.json(out);
  }));

  return r;
}
