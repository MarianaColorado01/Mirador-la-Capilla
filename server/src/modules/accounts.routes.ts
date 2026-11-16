import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { calculateBill, type BillableAccount } from '@mirador/shared';
import { getSettings, type DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import type { Emit } from '../lib/events';
import { httpError, route } from '../lib/http';
import { crossedMin } from '../lib/stock';
import { iso, loadAccount, loadInvoice, subtotalOf } from '../services/views';

const OpenBody = z.object({ tableNumber: z.number().int().positive() });
const MoveBody = z.object({ tableNumber: z.number({ error: 'Elige la mesa destino' }).int().positive() });
const MergeBody = z.object({ intoAccountId: z.number({ error: 'Elige la cuenta a la que se une' }).int().positive() });
const RoundBody = z.object({
  items: z
    .array(z.object({
      productId: z.number().int().positive(),
      qty: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1'),
      note: z.string().trim().max(100, 'La nota admite hasta 100 caracteres').nullish(),
    }))
    .min(1, 'Agrega al menos un producto'),
});
const ChargeBody = z.object({
  discount: z.coerce.string().default(''),
  tipPercent: z.coerce.string().default(''),
  method: z.enum(['efectivo', 'tarjeta', 'transferencia']),
  received: z.coerce.string().optional(),
});

interface ProductRow { id: number; name: string; price: number; cost: number; stock: number; min_stock: number; active: number }
interface AccountRow { id: number; table_id: number; table_number: number; status: 'abierta' | 'por_cobrar' | 'pagada'; waiter_name: string }

export function accountRoutes(db: DB, emit: Emit) {
  const r = Router();
  r.use(requireAuth(db));

  const getAccount = (id: number) => {
    const a = db.prepare(`SELECT a.*, t.number AS table_number, u.name AS waiter_name FROM accounts a
      JOIN tables t ON t.id = a.table_id JOIN users u ON u.id = a.waiter_id WHERE a.id = ?`).get(id) as AccountRow | undefined;
    if (!a) throw httpError(404, 'Cuenta no encontrada');
    return a;
  };

  // RF-38: cuentas por cobrar
  r.get('/', requireRole('caja', 'todo'), route((req, res) => {
    const status = String(req.query.status ?? 'por_cobrar');
    if (!['abierta', 'por_cobrar'].includes(status)) throw httpError(400, 'Estado no válido', 'status');
    const rows = db.prepare(`SELECT a.id, t.number AS table_number, u.name AS waiter, a.opened_at,
        (SELECT COUNT(*) FROM rounds rr WHERE rr.account_id = a.id) AS rounds,
        (SELECT COUNT(*) FROM round_items i JOIN rounds rr ON rr.id = i.round_id WHERE rr.account_id = a.id AND i.voided_at IS NOT NULL) AS voided
      FROM accounts a JOIN tables t ON t.id = a.table_id JOIN users u ON u.id = a.waiter_id
      WHERE a.status = ? ORDER BY a.opened_at`).all(status) as { id: number; table_number: number; waiter: string; opened_at: string; rounds: number; voided: number }[];
    const out: BillableAccount[] = rows.map((a) => ({
      id: a.id, tableNumber: a.table_number, waiter: a.waiter, subtotal: subtotalOf(db, a.id), rounds: a.rounds, voidedItems: a.voided, openedAt: iso(a.opened_at),
    }));
    res.json(out);
  }));

  // RF-17: abrir mesa; RN-01 una sola cuenta abierta por mesa
  r.post('/', requireRole('mesero', 'todo'), route((req, res) => {
    const { tableNumber } = OpenBody.parse(req.body);
    const table = db.prepare('SELECT id FROM tables WHERE number = ? AND active = 1').get(tableNumber) as { id: number } | undefined;
    if (!table) throw httpError(404, `La mesa ${tableNumber} no existe`);
    const result = db.transaction(() => {
      const existing = db.prepare(`SELECT a.id, u.name FROM accounts a JOIN users u ON u.id = a.waiter_id
        WHERE a.table_id = ? AND a.status IN ('abierta','por_cobrar')`).get(table.id) as { id: number; name: string } | undefined;
      if (existing) return { conflict: existing };
      const id = Number(db.prepare("INSERT INTO accounts(table_id, waiter_id, status) VALUES(?, ?, 'abierta')").run(table.id, req.user!.id).lastInsertRowid);
      audit(db, req.user!.id, 'abrir', 'cuenta', id, { tableNumber });
      return { id };
    })();
    if ('conflict' in result && result.conflict) {
      res.status(409).json({ error: `${result.conflict.name} ya abrió la mesa ${tableNumber}`, accountId: result.conflict.id });
      return;
    }
    emit('mesa:actualizada', { accountId: result.id, tableNumber, status: 'ocupada' });
    res.status(201).json(loadAccount(db, result.id));
  }));

  // RF-18: cuenta con sus rondas
  r.get('/:id', route((req, res) => {
    const a = loadAccount(db, Number(req.params.id));
    if (!a) throw httpError(404, 'Cuenta no encontrada');
    res.json(a);
  }));

  // RF-27: confirmar ronda en una transacción, con clave de idempotencia
  r.post('/:id/rounds', requireRole('mesero', 'todo'), route((req, res) => {
    const key = String(req.header('Idempotency-Key') ?? '').trim();
    if (key.length < 8) throw httpError(400, 'Falta la clave de idempotencia');
    const { items } = RoundBody.parse(req.body);
    const accountId = Number(req.params.id);
    const single = req.user!.role === 'todo' && getSettings(db).singleOperator; // RF-29
    const lowStock: ProductRow[] = [];
    const hash = createHash('sha256')
      .update(JSON.stringify({ accountId, items: items.map((i) => [i.productId, i.qty, i.note || null]) }))
      .digest('hex');

    const out = db.transaction(() => {
      const prev = db.prepare('SELECT round_id, body_hash FROM idempotency_keys WHERE key = ?').get(key) as { round_id: number; body_hash: string | null } | undefined;
      if (prev) {
        // Reintento con la clave de una ronda que sí llegó, pero con otro contenido: no se devuelve
        // la ronda vieja como si fuera esta, porque el mesero perdería lo que agregó.
        if (prev.body_hash && prev.body_hash !== hash)
          throw httpError(422, 'La ronda anterior sí llegó a caja. Revisa la cuenta y deja en el borrador solo lo nuevo.', 'Idempotency-Key');
        return { roundId: prev.round_id, replay: true };
      }

      const a = getAccount(accountId);
      if (a.status !== 'abierta') throw httpError(409, a.status === 'por_cobrar' ? 'La cuenta está por cobrar: pide a caja que la reabra' : 'La cuenta ya está pagada');

      // RN-08: agrupar por producto para validar el total pedido contra el stock
      const wanted = new Map<number, number>();
      for (const it of items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.qty);
      const products = new Map<number, ProductRow>();
      for (const [pid, qty] of wanted) {
        const p = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as ProductRow | undefined;
        if (!p || !p.active) throw httpError(409, 'Un producto de la ronda ya no está disponible');
        if (p.stock < qty) throw httpError(409, `${p.name}: solo quedan ${p.stock}`, `product:${p.id}`);
        products.set(pid, p);
      }

      const { n } = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM rounds WHERE account_id = ?').get(accountId) as { n: number };
      const roundId = Number(db.prepare('INSERT INTO rounds(account_id, number, status, taken_by) VALUES(?, ?, ?, ?)')
        .run(accountId, n, single ? 'entregado' : 'tomado', req.user!.id).lastInsertRowid);
      const insItem = db.prepare('INSERT INTO round_items(round_id, product_id, qty, unit_price, unit_cost, note) VALUES(?, ?, ?, ?, ?, ?)');
      for (const it of items) {
        const p = products.get(it.productId)!;
        insItem.run(roundId, p.id, it.qty, p.price, p.cost, it.note || null); // RN-03 precio y costo congelados
      }
      const move = db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'salida', ?, 'Venta', ?, ?)");
      for (const [pid, qty] of wanted) {
        const p = products.get(pid)!;
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, pid); // RN-02
        move.run(pid, -qty, `ronda:${roundId}`, req.user!.id);
        if (crossedMin(p.stock, p.stock - qty, p.min_stock)) lowStock.push({ ...p, stock: p.stock - qty });
      }
      db.prepare('INSERT INTO idempotency_keys(key, round_id, body_hash) VALUES(?, ?, ?)').run(key, roundId, hash);
      audit(db, req.user!.id, 'confirmar', 'ronda', roundId, { accountId, items });
      return { roundId, replay: false, tableNumber: a.table_number };
    })();

    if (!out.replay) {
      emit('ronda:creada', { accountId, roundId: out.roundId, tableNumber: out.tableNumber! });
      for (const p of lowStock) emit('stock:bajo', { productId: p.id, name: p.name, stock: p.stock, minStock: p.min_stock }, []);
    }
    res.status(out.replay ? 200 : 201).json(loadAccount(db, accountId));
  }));

  // RF-19: pedir la cuenta → por cobrar; RN-07 bloquea nuevas rondas
  r.post('/:id/request-bill', requireRole('mesero', 'todo', 'caja'), route((req, res) => {
    const a = getAccount(Number(req.params.id));
    if (a.status !== 'abierta') throw httpError(409, 'La cuenta no está abierta');
    if (subtotalOf(db, a.id) <= 0) throw httpError(409, 'La cuenta no tiene consumos');
    db.transaction(() => {
      db.prepare("UPDATE accounts SET status = 'por_cobrar' WHERE id = ?").run(a.id);
      audit(db, req.user!.id, 'pedir_cuenta', 'cuenta', a.id);
    })();
    emit('mesa:actualizada', { accountId: a.id, tableNumber: a.table_number, status: 'por_cobrar' });
    res.json(loadAccount(db, a.id));
  }));

  // RF-21: reabrir una cuenta por cobrar
  r.post('/:id/reopen', requireRole('caja', 'todo'), route((req, res) => {
    const a = getAccount(Number(req.params.id));
    if (a.status !== 'por_cobrar') throw httpError(409, 'Solo se reabre una cuenta por cobrar');
    db.transaction(() => {
      db.prepare("UPDATE accounts SET status = 'abierta' WHERE id = ?").run(a.id);
      audit(db, req.user!.id, 'reabrir', 'cuenta', a.id);
    })();
    emit('mesa:actualizada', { accountId: a.id, tableNumber: a.table_number, status: 'ocupada' });
    res.json(loadAccount(db, a.id));
  }));

  const tableStatus = (s: AccountRow['status']) => (s === 'por_cobrar' ? 'por_cobrar' : 'ocupada');

  // RF-20: mover la cuenta a otra mesa libre (RN-01: la destino no puede tener cuenta)
  r.post('/:id/move', requireRole('caja', 'todo'), route((req, res) => {
    const { tableNumber } = MoveBody.parse(req.body);
    const out = db.transaction(() => {
      const a = getAccount(Number(req.params.id));
      if (a.status === 'pagada') throw httpError(409, 'La cuenta ya está cerrada');
      if (a.table_number === tableNumber) throw httpError(400, 'La cuenta ya está en esa mesa', 'tableNumber');
      const t = db.prepare('SELECT id FROM tables WHERE number = ? AND active = 1').get(tableNumber) as { id: number } | undefined;
      if (!t) throw httpError(404, `La mesa ${tableNumber} no existe`, 'tableNumber');
      const busy = db.prepare("SELECT 1 FROM accounts WHERE table_id = ? AND status IN ('abierta','por_cobrar')").get(t.id);
      if (busy) throw httpError(409, `La mesa ${tableNumber} está ocupada: elige una libre o une las cuentas`, 'tableNumber');
      db.prepare('UPDATE accounts SET table_id = ? WHERE id = ?').run(t.id, a.id);
      audit(db, req.user!.id, 'mover', 'cuenta', a.id, { from: a.table_number, to: tableNumber });
      return a;
    })();
    emit('mesa:actualizada', { accountId: out.id, tableNumber: out.table_number, status: 'libre' });
    emit('mesa:actualizada', { accountId: out.id, tableNumber, status: tableStatus(out.status) });
    res.json(loadAccount(db, out.id));
  }));

  // RF-20: unir esta cuenta a otra. Sus rondas pasan a la destino y esta queda cerrada
  // ('pagada' sin factura, con merged_into) en vez de borrarse (RN-04); la mesa queda libre.
  r.post('/:id/merge', requireRole('caja', 'todo'), route((req, res) => {
    const { intoAccountId } = MergeBody.parse(req.body);
    const out = db.transaction(() => {
      const from = getAccount(Number(req.params.id));
      if (from.id === intoAccountId) throw httpError(400, 'Elige otra cuenta', 'intoAccountId');
      const into = getAccount(intoAccountId);
      if (from.status === 'pagada' || into.status === 'pagada') throw httpError(409, 'Solo se unen cuentas abiertas o por cobrar');
      const { max } = db.prepare('SELECT COALESCE(MAX(number), 0) AS max FROM rounds WHERE account_id = ?').get(into.id) as { max: number };
      const rounds = db.prepare('SELECT id FROM rounds WHERE account_id = ? ORDER BY number').all(from.id) as { id: number }[];
      // Se renumeran a continuación de las rondas de la destino (número único por cuenta).
      const moveRound = db.prepare('UPDATE rounds SET account_id = ?, number = ? WHERE id = ?');
      rounds.forEach((rd, i) => moveRound.run(into.id, max + i + 1, rd.id));
      db.prepare("UPDATE accounts SET status = 'pagada', closed_at = datetime('now'), merged_into = ? WHERE id = ?").run(into.id, from.id);
      audit(db, req.user!.id, 'unir', 'cuenta', from.id, { into: into.id, fromTable: from.table_number, intoTable: into.table_number, rounds: rounds.map((x) => x.id) });
      return { from, into };
    })();
    emit('mesa:actualizada', { accountId: out.from.id, tableNumber: out.from.table_number, status: 'libre' });
    emit('mesa:actualizada', { accountId: out.into.id, tableNumber: out.into.table_number, status: tableStatus(out.into.status) });
    res.json(loadAccount(db, out.into.id));
  }));

  // RF-39 a RF-42: cobrar, facturar con número consecutivo y liberar la mesa
  r.post('/:id/charge', requireRole('caja', 'todo'), route((req, res) => {
    const body = ChargeBody.parse(req.body);
    const accountId = Number(req.params.id);
    const invoiceId = db.transaction(() => {
      const a = getAccount(accountId);
      if (a.status !== 'por_cobrar') throw httpError(409, a.status === 'pagada' ? 'La cuenta ya está pagada' : 'Primero hay que pedir la cuenta');
      const subtotal = subtotalOf(db, accountId);
      const s = getSettings(db);
      const b = calculateBill({ subtotal, discount: body.discount, tipPercent: body.tipPercent, taxPercent: s.taxPercent, method: body.method, received: body.received });
      const [field, msg] = Object.entries(b.errors)[0] ?? [];
      if (field) throw httpError(400, msg!, field);
      if (!b.ready) throw httpError(400, 'Escribe el monto recibido', 'received');

      const { n } = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices').get() as { n: number }; // RN-06
      const id = Number(db.prepare(`INSERT INTO invoices(number, account_id, subtotal, discount, tip_percent, tip, tax_percent, tax, total, cashier_id)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(n, accountId, subtotal, b.discount, b.tipPercent, b.tip, s.taxPercent, b.tax, b.total, req.user!.id).lastInsertRowid);
      const received = body.method === 'efectivo' ? b.total + (b.change ?? 0) : null;
      db.prepare('INSERT INTO payments(invoice_id, method, amount, received, change) VALUES(?, ?, ?, ?, ?)').run(id, body.method, b.total, received, b.change);
      db.prepare("UPDATE accounts SET status = 'pagada', closed_at = datetime('now') WHERE id = ?").run(accountId);
      audit(db, req.user!.id, 'cobrar', 'factura', id, { number: n, total: b.total, method: body.method });
      return { id, tableNumber: a.table_number };
    })();
    emit('mesa:actualizada', { accountId, tableNumber: invoiceId.tableNumber, status: 'libre' });
    res.status(201).json(loadInvoice(db, invoiceId.id));
  }));

  return r;
}
