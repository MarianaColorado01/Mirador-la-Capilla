import { Router } from 'express';
import { isDate, PurchaseSchema } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';
import { listPurchases, loadPurchase } from '../services/views';

/** Compras (RF-53 a RF-55). Todo es del dueño. */
export function purchaseRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  // RF-55: historial con ?supplierId= y rango ?from=&to= (AAAA-MM-DD, ambos incluidos).
  r.get('/', route((req, res) => {
    const supplier = req.query.supplierId ? Number(req.query.supplierId) : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    if (supplier !== null && !(Number.isInteger(supplier) && supplier > 0)) throw httpError(400, 'Proveedor no válido', 'supplierId');
    if (from && !isDate(from)) throw httpError(400, 'Escribe la fecha inicial como AAAA-MM-DD', 'from');
    if (to && !isDate(to)) throw httpError(400, 'Escribe la fecha final como AAAA-MM-DD', 'to');
    if (from && to && from > to) throw httpError(400, 'La fecha final no puede ser anterior a la inicial', 'to');
    res.json(listPurchases(db, '(@supplier IS NULL OR pu.supplier_id = @supplier) AND (@from IS NULL OR pu.date >= @from) AND (@to IS NULL OR pu.date <= @to)',
      { supplier, from, to }));
  }));

  r.get('/:id', route((req, res) => {
    const p = loadPurchase(db, Number(req.params.id));
    if (!p) throw httpError(404, 'Compra no encontrada');
    res.json(p);
  }));

  // RF-53 / RF-54: todo o nada. Cada ítem sube el stock con una entrada referencia compra:<id> (RN-02)
  // y deja su costo como el último costo del producto. Los ítems de ronda guardan su propio unit_cost
  // congelado (RN-03), así que cambiar products.cost no toca nada vendido. El total lo calcula el servidor.
  r.post('/', route((req, res) => {
    const b = PurchaseSchema.parse(req.body);
    const userId = req.user!.id;
    const id = db.transaction(() => {
      const s = db.prepare('SELECT name, active FROM suppliers WHERE id = ?').get(b.supplierId) as { name: string; active: number } | undefined;
      if (!s?.active) throw httpError(400, 'Elige un proveedor activo', 'supplierId');
      const total = b.items.reduce((t, i) => t + i.qty * i.unitCost, 0);
      const id = Number(db.prepare('INSERT INTO purchases(supplier_id, date, total, user_id) VALUES(?, ?, ?, ?)').run(b.supplierId, b.date, total, userId).lastInsertRowid);
      b.items.forEach((i, n) => {
        const p = db.prepare('SELECT name, active FROM products WHERE id = ?').get(i.productId) as { name: string; active: number } | undefined;
        if (!p) throw httpError(400, 'Producto no encontrado', `items.${n}.productId`);
        if (!p.active) throw httpError(400, `${p.name} está inactivo: reactívalo para comprarlo`, `items.${n}.productId`);
        db.prepare('INSERT INTO purchase_items(purchase_id, product_id, qty, unit_cost) VALUES(?, ?, ?, ?)').run(id, i.productId, i.qty, i.unitCost);
        db.prepare('UPDATE products SET stock = stock + ?, cost = ? WHERE id = ?').run(i.qty, i.unitCost, i.productId);
        db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'entrada', ?, ?, ?, ?)")
          .run(i.productId, i.qty, `Compra a ${s.name}`, `compra:${id}`, userId);
      });
      audit(db, userId, 'crear', 'compra', id, { ...b, total });
      return id;
    })();
    res.status(201).json(loadPurchase(db, id));
  }));

  return r;
}
