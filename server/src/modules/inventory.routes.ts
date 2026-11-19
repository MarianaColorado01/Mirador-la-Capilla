import { Router } from 'express';
import { AdjustmentInput, CategoryInput, type Category, type ProductOwnerView, type RestockSuggestion } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import type { Emit } from '../lib/events';
import { httpError, route } from '../lib/http';

export function categoryRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', route((_req, res) => {
    const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS products
      FROM categories c ORDER BY c.active DESC, c.name`).all() as { id: number; name: string; active: number; products: number }[];
    res.json(rows.map<Category>((c) => ({ id: c.id, name: c.name, active: !!c.active, products: c.products })));
  }));

  // RF-15: crear, renombrar y desactivar categorías
  r.post('/', requireRole('dueno'), route((req, res) => {
    const c = CategoryInput.parse(req.body);
    if (db.prepare('SELECT 1 FROM categories WHERE lower(name) = lower(?)').get(c.name)) throw httpError(409, 'Ya existe una categoría con ese nombre', 'name');
    const id = Number(db.prepare('INSERT INTO categories(name, active) VALUES(?, ?)').run(c.name, c.active ? 1 : 0).lastInsertRowid);
    audit(db, req.user!.id, 'crear', 'categoria', id, c);
    res.status(201).json({ id, name: c.name, active: c.active, products: 0 });
  }));

  r.patch('/:id', requireRole('dueno'), route((req, res) => {
    const id = Number(req.params.id);
    const before = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as { name: string; active: number } | undefined;
    if (!before) throw httpError(404, 'Categoría no encontrada');
    const c = CategoryInput.parse({ name: before.name, active: !!before.active, ...req.body });
    if (db.prepare('SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id != ?').get(c.name, id)) throw httpError(409, 'Ya existe una categoría con ese nombre', 'name');
    db.prepare('UPDATE categories SET name = ?, active = ? WHERE id = ?').run(c.name, c.active ? 1 : 0, id);
    audit(db, req.user!.id, 'editar', 'categoria', id, { antes: before, despues: c });
    res.json({ id, ...c });
  }));

  return r;
}

export function inventoryRoutes(db: DB, emit: Emit) {
  const r = Router();
  r.use(requireAuth, requireRole('dueno'));

  // RF-47: stock de cada producto; los que están en o bajo el mínimo van primero
  r.get('/', route((_req, res) => {
    const rows = db.prepare(`SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id
      ORDER BY p.active DESC, (p.stock <= p.min_stock) DESC, c.name, p.name`).all() as
      { id: number; name: string; category_id: number; category_name: string; price: number; cost: number; stock: number; min_stock: number; image_url: string | null; active: number }[];
    res.json(rows.map<ProductOwnerView & { low: boolean }>((p) => ({
      id: p.id, name: p.name, categoryId: p.category_id, categoryName: p.category_name, price: p.price, cost: p.cost, margin: p.price - p.cost,
      stock: p.stock, minStock: p.min_stock, imageUrl: p.image_url, active: !!p.active, low: p.stock <= p.min_stock,
    })));
  }));

  // RF-48: ajuste manual con motivo. RN-02: el número nunca se edita directo, siempre hay movimiento.
  r.post('/adjustments', route((req, res) => {
    const a = AdjustmentInput.parse(req.body);
    const out = db.transaction(() => {
      const p = db.prepare('SELECT id, name, stock, min_stock FROM products WHERE id = ?').get(a.productId) as
        | { id: number; name: string; stock: number; min_stock: number }
        | undefined;
      if (!p) throw httpError(404, 'Producto no encontrado', 'productId');
      const delta = a.type === 'entrada' ? a.qty : a.type === 'salida' ? -a.qty : a.qty - p.stock;
      if (a.type !== 'ajuste' && a.qty === 0) throw httpError(400, 'La cantidad debe ser mayor que 0', 'qty');
      if (delta === 0) throw httpError(400, 'El stock contado es igual al actual: no hay nada que ajustar', 'qty');
      if (p.stock + delta < 0) throw httpError(400, `Solo hay ${p.stock} en stock`, 'qty');
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, p.id);
      const id = Number(db.prepare('INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, ?, ?, ?, ?, ?)')
        .run(p.id, a.type, delta, a.reason, 'ajuste manual', req.user!.id).lastInsertRowid);
      audit(db, req.user!.id, 'ajustar', 'producto', p.id, { ...a, delta });
      return { ...p, stock: p.stock + delta, movementId: id, delta };
    })();
    if (out.stock <= out.min_stock && out.stock - out.delta > out.min_stock) {
      emit('stock:bajo', { productId: out.id, name: out.name, stock: out.stock, minStock: out.min_stock }, []);
    }
    res.status(201).json({ productId: out.id, stock: out.stock, delta: out.delta });
  }));

  // RF-51: qué surtir según stock bajo y lo más vendido en los últimos 7 días
  r.get('/suggestions', route((_req, res) => {
    const rows = db.prepare(`SELECT p.id, p.name, p.stock, p.min_stock,
        COALESCE((SELECT SUM(i.qty) FROM round_items i JOIN rounds r ON r.id = i.round_id
          WHERE i.product_id = p.id AND i.voided_at IS NULL AND r.created_at >= datetime('now', '-7 days')), 0) AS sold,
        (SELECT pu.supplier_id FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pi.product_id = p.id ORDER BY pu.date DESC, pu.id DESC LIMIT 1) AS supplier_id
      FROM products p WHERE p.active = 1`).all() as { id: number; name: string; stock: number; min_stock: number; sold: number; supplier_id: number | null }[];
    const out: RestockSuggestion[] = rows
      .map((p) => {
        // Llegar a lo que se vendió en una semana, y al menos al doble del mínimo.
        const target = Math.max(p.min_stock * 2, p.sold);
        return { productId: p.id, name: p.name, stock: p.stock, minStock: p.min_stock, soldLast7Days: p.sold, suggestedQty: Math.max(0, target - p.stock), supplierId: p.supplier_id };
      })
      .filter((s) => s.suggestedQty > 0 && (s.stock <= s.minStock || s.soldLast7Days > s.stock))
      .sort((a, b) => Number(b.stock <= b.minStock) - Number(a.stock <= a.minStock) || b.soldLast7Days - a.soldLast7Days);
    res.json(out);
  }));

  return r;
}
