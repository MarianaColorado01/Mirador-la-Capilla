import { Router } from 'express';
import { StockAdjustmentSchema, type StockMovement, type StockSuggestion } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import type { Emit } from '../lib/events';
import { httpError, route } from '../lib/http';
import { crossedMin } from '../lib/stock';
import { iso } from '../services/views';

/** Cuántos de los más vendidos entran en la sugerencia de surtido además de los de stock bajo (RF-51). */
const TOP_SELLERS = 5;

/** Inventario (RF-47 a RF-51). Todo es del dueño; el listado de stock usa GET /products?all=1. */
export function inventoryRoutes(db: DB, emit: Emit) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  // RF-48: entrada suma, salida resta y «ajuste» es un conteo físico: qty es el stock real y se
  // registra la diferencia. Nunca deja stock negativo. RN-02: movimiento y stock en la misma transacción.
  r.post('/adjustments', route((req, res) => {
    const b = StockAdjustmentSchema.parse(req.body);
    const out = db.transaction(() => {
      const p = db.prepare('SELECT id, name, stock, min_stock FROM products WHERE id = ?').get(b.productId) as
        | { id: number; name: string; stock: number; min_stock: number }
        | undefined;
      if (!p) throw httpError(404, 'Producto no encontrado', 'productId');
      const delta = b.type === 'entrada' ? b.qty : b.type === 'salida' ? -b.qty : b.qty - p.stock;
      if (p.stock + delta < 0) throw httpError(409, `Solo hay ${p.stock} en stock: no puede quedar negativo`, 'qty');
      if (delta === 0) throw httpError(409, `El conteo coincide con el stock (${p.stock}): no hay nada que ajustar`, 'qty');
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, p.id);
      const id = db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, ?, ?, ?, 'manual', ?)")
        .run(p.id, b.type, delta, b.reason, req.user!.id).lastInsertRowid;
      audit(db, req.user!.id, 'ajustar', 'inventario', p.id, { ...b, from: p.stock, to: p.stock + delta });
      return { p, delta, id: Number(id) };
    })();
    const after = out.p.stock + out.delta;
    if (crossedMin(out.p.stock, after, out.p.min_stock))
      emit('stock:bajo', { productId: out.p.id, name: out.p.name, stock: after, minStock: out.p.min_stock }, []);
    const m = db.prepare(`SELECT m.id, m.type, m.qty, m.reason, m.reference, m.created_at, u.name AS user
      FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`).get(out.id) as Omit<StockMovement, 'createdAt'> & { created_at: string };
    const { created_at, ...rest } = m;
    res.status(201).json({ ...rest, createdAt: iso(created_at) } satisfies StockMovement);
  }));

  // RF-51: qué surtir. Entran los activos en o bajo el mínimo y los más vendidos de 7 días.
  // Vendido = ítems no anulados de cuentas con factura no anulada. Una cuenta unida (merged_into)
  // no tiene factura y sus rondas ya pasaron a la otra cuenta, así que se cuentan una sola vez.
  // Cantidad sugerida = max(2 × mínimo, vendido en 7 días) − stock; si da 0 o menos no se sugiere.
  r.get('/suggestions', route((_req, res) => {
    const rows = db.prepare(`WITH sold AS (
        SELECT i.product_id, SUM(i.qty) AS qty FROM round_items i
        JOIN rounds r ON r.id = i.round_id
        JOIN invoices v ON v.account_id = r.account_id
        WHERE i.voided_at IS NULL AND v.voided_at IS NULL AND v.created_at >= datetime('now', '-7 days')
        GROUP BY i.product_id)
      SELECT p.id, p.name, c.name AS category_name, p.stock, p.min_stock, COALESCE(s.qty, 0) AS sold
      FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN sold s ON s.product_id = p.id
      WHERE p.active = 1 ORDER BY sold DESC, p.name`).all() as
      { id: number; name: string; category_name: string; stock: number; min_stock: number; sold: number }[];
    const top = new Set(rows.filter((x) => x.sold > 0).slice(0, TOP_SELLERS).map((x) => x.id));
    const out: StockSuggestion[] = rows
      .filter((x) => x.stock <= x.min_stock || top.has(x.id))
      .map((x) => ({
        productId: x.id, name: x.name, categoryName: x.category_name, stock: x.stock, minStock: x.min_stock,
        sold7d: x.sold, suggested: Math.max(2 * x.min_stock, x.sold) - x.stock, lowStock: x.stock <= x.min_stock,
      }))
      .filter((x) => x.suggested > 0)
      .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || b.sold7d - a.sold7d || a.name.localeCompare(b.name));
    res.json(out);
  }));

  return r;
}
