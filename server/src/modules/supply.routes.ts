/* Surtido: proveedores (RF-52), compras (RF-53 a RF-56) y gastos adicionales (RF-57). */
import { Router } from 'express';
import { DateRange, ExpenseInput, PurchaseInput, SupplierInput, type Expense, type Purchase, type PurchasesBySupplier, type Supplier } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';

interface SupplierRow { id: number; name: string; phone: string | null; notes: string | null; address: string | null; lat: number | null; lng: number | null; active: number }

const toSupplier = (db: DB, s: SupplierRow): Supplier => {
  const last = db.prepare('SELECT date, total FROM purchases WHERE supplier_id = ? ORDER BY date DESC, id DESC LIMIT 1').get(s.id) as { date: string; total: number } | undefined;
  return { id: s.id, name: s.name, phone: s.phone ?? '', notes: s.notes ?? '', address: s.address ?? '', lat: s.lat, lng: s.lng, active: !!s.active, lastPurchase: last ?? null };
};

/** Rango opcional ?from&to; valida que desde ≤ hasta. */
function range(q: Record<string, unknown>): { from: string | null; to: string | null } {
  const from = q.from ? String(q.from) : null;
  const to = q.to ? String(q.to) : null;
  if (from && to) DateRange.parse({ from, to });
  return { from, to };
}

export function supplierRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth);

  // Todos los roles los ven en el mapa (RF-61); solo el dueño los administra.
  r.get('/', route((req, res) => {
    const all = req.user!.role === 'dueno' && req.query.all === '1';
    const rows = db.prepare(`SELECT * FROM suppliers WHERE (@all = 1 OR active = 1) ORDER BY active DESC, name`).all({ all: all ? 1 : 0 }) as SupplierRow[];
    res.json(rows.map((s) => toSupplier(db, s)));
  }));

  r.get('/:id', route((req, res) => {
    const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(req.params.id)) as SupplierRow | undefined;
    if (!s) throw httpError(404, 'Proveedor no encontrado');
    res.json(toSupplier(db, s));
  }));

  r.post('/', requireRole('dueno'), route((req, res) => {
    const s = SupplierInput.parse(req.body);
    const id = Number(db.prepare('INSERT INTO suppliers(name, phone, notes, address, lat, lng, active) VALUES(?, ?, ?, ?, ?, ?, ?)')
      .run(s.name, s.phone, s.notes, s.address, s.lat, s.lng, s.active ? 1 : 0).lastInsertRowid);
    audit(db, req.user!.id, 'crear', 'proveedor', id, s);
    res.status(201).json(toSupplier(db, db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow));
  }));

  r.patch('/:id', requireRole('dueno'), route((req, res) => {
    const id = Number(req.params.id);
    const before = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow | undefined;
    if (!before) throw httpError(404, 'Proveedor no encontrado');
    const s = SupplierInput.parse({ ...toSupplier(db, before), ...req.body });
    db.prepare('UPDATE suppliers SET name = ?, phone = ?, notes = ?, address = ?, lat = ?, lng = ?, active = ? WHERE id = ?')
      .run(s.name, s.phone, s.notes, s.address, s.lat, s.lng, s.active ? 1 : 0, id);
    audit(db, req.user!.id, 'editar', 'proveedor', id, { antes: before, despues: s });
    res.json(toSupplier(db, db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow));
  }));

  return r;
}

export function purchaseRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth, requireRole('dueno'));

  const load = (id: number): Purchase | null => {
    const p = db.prepare(`SELECT pu.*, s.name AS supplier_name, u.name AS user_name FROM purchases pu
      JOIN suppliers s ON s.id = pu.supplier_id JOIN users u ON u.id = pu.user_id WHERE pu.id = ?`).get(id) as
      | { id: number; supplier_id: number; supplier_name: string; date: string; total: number; user_name: string }
      | undefined;
    if (!p) return null;
    const items = db.prepare(`SELECT pi.*, pr.name AS product_name FROM purchase_items pi JOIN products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = ? ORDER BY pi.id`).all(id) as { product_id: number; product_name: string; qty: number; unit_cost: number }[];
    return {
      id: p.id, supplierId: p.supplier_id, supplierName: p.supplier_name, date: p.date, total: p.total, user: p.user_name,
      items: items.map((i) => ({ productId: i.product_id, productName: i.product_name, qty: i.qty, unitCost: i.unit_cost, total: i.qty * i.unit_cost })),
    };
  };

  // RF-53 / RF-54: registrar la compra, subir el stock y actualizar el último costo, en una transacción
  r.post('/', route((req, res) => {
    const input = PurchaseInput.parse(req.body);
    const id = db.transaction(() => {
      if (!db.prepare('SELECT 1 FROM suppliers WHERE id = ? AND active = 1').get(input.supplierId)) throw httpError(400, 'Elige un proveedor activo', 'supplierId');
      const total = input.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
      const pid = Number(db.prepare('INSERT INTO purchases(supplier_id, date, total, user_id) VALUES(?, ?, ?, ?)').run(input.supplierId, input.date, total, req.user!.id).lastInsertRowid);
      for (const [k, it] of input.items.entries()) {
        if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(it.productId)) throw httpError(400, 'Producto no encontrado', `items.${k}.productId`);
        db.prepare('INSERT INTO purchase_items(purchase_id, product_id, qty, unit_cost) VALUES(?, ?, ?, ?)').run(pid, it.productId, it.qty, it.unitCost);
        db.prepare('UPDATE products SET stock = stock + ?, cost = ? WHERE id = ?').run(it.qty, it.unitCost, it.productId);
        db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'entrada', ?, 'Compra de surtido', ?, ?)")
          .run(it.productId, it.qty, `compra:${pid}`, req.user!.id);
      }
      audit(db, req.user!.id, 'registrar', 'compra', pid, input);
      return pid;
    })();
    res.status(201).json(load(id));
  }));

  // RF-55: historial filtrable por proveedor y fecha
  r.get('/', route((req, res) => {
    const { from, to } = range(req.query);
    const supplierId = Number(req.query.supplierId) || null;
    const ids = db.prepare(`SELECT id FROM purchases WHERE (@s IS NULL OR supplier_id = @s) AND (@from IS NULL OR date >= @from) AND (@to IS NULL OR date <= @to)
      ORDER BY date DESC, id DESC LIMIT 100`).all({ s: supplierId, from, to }) as { id: number }[];
    res.json(ids.map((x) => load(x.id)));
  }));

  // RF-56: total comprado por proveedor en un rango
  r.get('/by-supplier', route((req, res) => {
    const { from, to } = range(req.query);
    const rows = db.prepare(`SELECT s.id AS supplier_id, s.name, COUNT(pu.id) AS purchases, COALESCE(SUM(pu.total), 0) AS total
      FROM suppliers s JOIN purchases pu ON pu.supplier_id = s.id
      WHERE (@from IS NULL OR pu.date >= @from) AND (@to IS NULL OR pu.date <= @to)
      GROUP BY s.id ORDER BY total DESC`).all({ from, to }) as { supplier_id: number; name: string; purchases: number; total: number }[];
    res.json(rows.map<PurchasesBySupplier>((x) => ({ supplierId: x.supplier_id, name: x.name, purchases: x.purchases, total: x.total })));
  }));

  r.get('/:id', route((req, res) => {
    const p = load(Number(req.params.id));
    if (!p) throw httpError(404, 'Compra no encontrada');
    res.json(p);
  }));

  return r;
}

export function expenseRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth, requireRole('dueno'));

  r.post('/', route((req, res) => {
    const e = ExpenseInput.parse(req.body);
    const id = Number(db.prepare('INSERT INTO expenses(concept, amount, date, user_id) VALUES(?, ?, ?, ?)').run(e.concept, e.amount, e.date, req.user!.id).lastInsertRowid);
    audit(db, req.user!.id, 'registrar', 'gasto', id, e);
    res.status(201).json({ id, ...e, user: req.user!.name } satisfies Expense);
  }));

  r.get('/', route((req, res) => {
    const { from, to } = range(req.query);
    const rows = db.prepare(`SELECT e.*, u.name AS user_name FROM expenses e JOIN users u ON u.id = e.user_id
      WHERE (@from IS NULL OR e.date >= @from) AND (@to IS NULL OR e.date <= @to) ORDER BY e.date DESC, e.id DESC LIMIT 200`).all({ from, to }) as
      { id: number; concept: string; amount: number; date: string; user_name: string }[];
    res.json(rows.map<Expense>((e) => ({ id: e.id, concept: e.concept, amount: e.amount, date: e.date, user: e.user_name })));
  }));

  return r;
}
