import { Router } from 'express';
import { TableCreateSchema, TableUpdateSchema, type TableAdmin, type TableSummary } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';
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

  // RF-22: administración de mesas, solo el dueño. Incluye las inactivas para reactivarlas.
  const ADMIN = `SELECT t.id, t.number, t.zone, t.active,
      EXISTS(SELECT 1 FROM accounts a WHERE a.table_id = t.id AND a.status IN ('abierta', 'por_cobrar')) AS busy
    FROM tables t`;
  type AdminRow = Omit<TableAdmin, 'active' | 'busy'> & { active: number; busy: number };
  const view = (t: AdminRow): TableAdmin => ({ ...t, active: !!t.active, busy: !!t.busy });
  const load = (id: number | bigint) => db.prepare(`${ADMIN} WHERE t.id = ?`).get(id) as AdminRow | undefined;

  r.get('/all', requireRole(), route((_req, res) => {
    res.json((db.prepare(`${ADMIN} ORDER BY t.active DESC, t.number`).all() as AdminRow[]).map(view));
  }));

  r.post('/', requireRole(), route((req, res) => {
    const { number, zone } = TableCreateSchema.parse(req.body);
    const row = db.transaction(() => {
      const twin = db.prepare('SELECT active FROM tables WHERE number = ?').get(number) as { active: number } | undefined;
      if (twin) throw httpError(409, twin.active ? `Ya existe la mesa ${number}` : `La mesa ${number} existe pero está inactiva: reactívala`, 'number');
      const id = db.prepare('INSERT INTO tables(number, zone) VALUES(?, ?)').run(number, zone || null).lastInsertRowid;
      audit(db, req.user!.id, 'crear', 'mesa', id, { number, zone });
      return load(id)!;
    })();
    res.status(201).json(view(row));
  }));

  r.patch('/:id', requireRole(), route((req, res) => {
    const body = TableUpdateSchema.parse(req.body);
    const id = Number(req.params.id);
    const row = db.transaction(() => {
      const t = load(id);
      if (!t) throw httpError(404, 'Mesa no encontrada');
      if (body.active === false && t.busy) throw httpError(409, `La mesa ${t.number} tiene una cuenta sin cerrar: cóbrala o muévela primero`, 'active');
      if (body.zone !== undefined) db.prepare('UPDATE tables SET zone = ? WHERE id = ?').run(body.zone || null, id);
      if (body.active !== undefined) db.prepare('UPDATE tables SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
      audit(db, req.user!.id, 'editar', 'mesa', id, body);
      return load(id)!;
    })();
    res.json(view(row));
  }));

  return r;
}
