import { Router } from 'express';
import { z } from 'zod';
import type { Role, RoundStatus } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import type { Emit } from '../lib/events';
import { httpError, route } from '../lib/http';
import { barQueue, loadAccount } from '../services/views';

const ORDER: RoundStatus[] = ['tomado', 'preparacion', 'listo', 'entregado'];
/** Quién puede llevar la ronda a cada estado (RF-30). El dueño puede todo. */
const WHO: Record<RoundStatus, Role[]> = {
  tomado: [],
  preparacion: ['barra', 'todo'],
  listo: ['barra', 'todo'],
  entregado: ['mesero', 'todo'],
};

const StatusBody = z.object({ status: z.enum(['preparacion', 'listo', 'entregado']) });
const VoidBody = z.object({
  reason: z.string().trim().min(3, 'Escribe el motivo de la anulación').max(200),
  restock: z.boolean().default(false),
});

interface RoundRow { id: number; account_id: number; status: RoundStatus; taken_by: number; taken_by_name: string; table_number: number; account_status: string }

export function roundRoutes(db: DB, emit: Emit) {
  const r = Router();
  r.use(requireAuth);

  const getRound = (id: number) => {
    const row = db.prepare(`SELECT r.*, u.name AS taken_by_name, t.number AS table_number, a.status AS account_status
      FROM rounds r JOIN users u ON u.id = r.taken_by JOIN accounts a ON a.id = r.account_id JOIN tables t ON t.id = a.table_id
      WHERE r.id = ?`).get(id) as RoundRow | undefined;
    if (!row) throw httpError(404, 'Ronda no encontrada');
    return row;
  };

  // RF-31: cola de barra (por defecto, todo lo que no se ha entregado)
  r.get('/', requireRole('barra', 'todo'), route((req, res) => {
    const raw = String(req.query.status ?? 'tomado,preparacion,listo').split(',');
    const statuses = raw.filter((s): s is RoundStatus => (ORDER as string[]).includes(s));
    if (!statuses.length) throw httpError(400, 'Estado no válido', 'status');
    res.json(barQueue(db, statuses));
  }));

  // RF-30: tomado → preparación → listo → entregado, solo hacia adelante y de a un paso
  r.patch('/:id/status', route((req, res) => {
    const { status } = StatusBody.parse(req.body);
    const round = getRound(Number(req.params.id));
    const role = req.user!.role;
    if (role !== 'dueno' && !WHO[status].includes(role)) throw httpError(403, 'Tu perfil no puede cambiar la ronda a ese estado');
    if (round.account_status === 'pagada') throw httpError(409, 'La cuenta ya está pagada');
    if (ORDER.indexOf(status) !== ORDER.indexOf(round.status) + 1) throw httpError(409, `La ronda está en «${round.status}» y no puede pasar a «${status}»`);
    db.transaction(() => {
      db.prepare('UPDATE rounds SET status = ? WHERE id = ?').run(status, round.id);
      audit(db, req.user!.id, 'estado', 'ronda', round.id, { from: round.status, to: status });
    })();
    emit('ronda:estado', { accountId: round.account_id, roundId: round.id, status, takenBy: round.taken_by_name, takenById: round.taken_by });
    res.json(loadAccount(db, round.account_id));
  }));

  // RF-33 a RF-36: anular un ítem según el estado de su ronda; RN-04 nada se borra
  r.post('/items/:itemId/void', route((req, res) => {
    const { reason, restock } = VoidBody.parse(req.body);
    const item = db.prepare('SELECT * FROM round_items WHERE id = ?').get(Number(req.params.itemId)) as
      | { id: number; round_id: number; product_id: number; qty: number; voided_at: string | null }
      | undefined;
    if (!item) throw httpError(404, 'Ítem no encontrado');
    if (item.voided_at) throw httpError(409, 'El ítem ya estaba anulado');
    const round = getRound(item.round_id);
    if (round.account_status === 'pagada') throw httpError(409, 'Cuenta pagada: solo el dueño la corrige anulando la factura');
    const role = req.user!.role;

    // Tabla 4.2 del documento
    let giveBack: boolean;
    if (round.status === 'tomado') {
      if (!['mesero', 'todo', 'caja', 'dueno'].includes(role)) throw httpError(403, 'Tu perfil no puede quitar ítems');
      giveBack = true; // siempre se devuelve
    } else if (round.status === 'preparacion' || round.status === 'listo') {
      if (!['caja', 'todo', 'dueno'].includes(role)) throw httpError(403, 'Solo caja o el dueño anulan ítems en preparación o listos');
      giveBack = restock; // decide quien anula
    } else {
      if (role !== 'dueno') throw httpError(403, 'Solo el dueño anula ítems ya entregados');
      giveBack = false; // queda como merma
    }

    db.transaction(() => {
      db.prepare("UPDATE round_items SET voided_at = datetime('now'), voided_by = ?, void_reason = ?, void_restocked = ? WHERE id = ?")
        .run(req.user!.id, reason, giveBack ? 1 : 0, item.id);
      if (giveBack) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.product_id);
        db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'ajuste', ?, ?, ?, ?)")
          .run(item.product_id, item.qty, `Anulación: ${reason}`, `ronda:${round.id}`, req.user!.id);
      }
      audit(db, req.user!.id, 'anular', 'item', item.id, { reason, restocked: giveBack, roundStatus: round.status });
    })();
    emit('item:anulado', { accountId: round.account_id, roundId: round.id, itemId: item.id });
    res.json(loadAccount(db, round.account_id));
  }));

  return r;
}
