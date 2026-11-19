import { Router } from 'express';
import { ProductInput, type Product, type ProductOwnerView, type StockMovement } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';
import { iso } from '../services/views';

interface Row {
  id: number; name: string; category_id: number; category_name: string; price: number; cost: number;
  stock: number; min_stock: number; image_url: string | null; active: number;
}

const SELECT = `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id`;

const toProduct = (r: Row): Product => ({
  id: r.id, name: r.name, categoryId: r.category_id, categoryName: r.category_name, price: r.price,
  stock: r.stock, minStock: r.min_stock, imageUrl: r.image_url, active: !!r.active,
});
const toOwner = (r: Row): ProductOwnerView => ({ ...toProduct(r), cost: r.cost, margin: r.price - r.cost });

export function productRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth);

  const get = (id: number) => db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined;
  const assertCategory = (id: number) => {
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ? AND active = 1').get(id)) throw httpError(400, 'Elige una categoría activa', 'categoryId');
  };

  // RF-10 / RF-11: listado activo, con búsqueda y filtro. RF-14: los inactivos no salen al tomar pedidos;
  // el dueño puede pedirlos con ?all=1 para administrarlos.
  r.get('/', route((req, res) => {
    const q = String(req.query.q ?? '').trim();
    const cat = Number(req.query.categoryId) || null;
    const all = req.user!.role === 'dueno' && req.query.all === '1';
    const rows = db.prepare(`${SELECT} WHERE (@all = 1 OR p.active = 1)
      AND (@q = '' OR p.name LIKE '%' || @q || '%')
      AND (@cat IS NULL OR p.category_id = @cat)
      ORDER BY c.name, p.name`).all({ q, cat, all: all ? 1 : 0 }) as Row[];
    res.json(req.user!.role === 'dueno' ? rows.map(toOwner) : rows.map(toProduct));
  }));

  // RF-12: detalle; el dueño ve costo y margen. Id inexistente → 404 con mensaje.
  r.get('/:id', route((req, res) => {
    const row = get(Number(req.params.id));
    if (!row) throw httpError(404, 'Producto no encontrado');
    res.json(req.user!.role === 'dueno' ? toOwner(row) : toProduct(row));
  }));

  // RF-49: historial de movimientos del producto
  r.get('/:id/movements', requireRole('dueno'), route((req, res) => {
    if (!get(Number(req.params.id))) throw httpError(404, 'Producto no encontrado');
    const rows = db.prepare(`SELECT m.*, u.name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 100`).all(Number(req.params.id)) as
      { id: number; type: StockMovement['type']; qty: number; reason: string | null; reference: string | null; user_name: string | null; created_at: string }[];
    res.json(rows.map<StockMovement>((m) => ({ id: m.id, type: m.type, qty: m.qty, reason: m.reason, reference: m.reference, user: m.user_name, createdAt: iso(m.created_at) })));
  }));

  // RF-13: crear producto. El stock arranca en 0 y solo sube con compras o ajustes (RN-02).
  r.post('/', requireRole('dueno'), route((req, res) => {
    const p = ProductInput.parse(req.body);
    assertCategory(p.categoryId);
    const id = Number(db.prepare('INSERT INTO products(name, category_id, price, cost, stock, min_stock, active) VALUES(?, ?, ?, ?, 0, ?, ?)')
      .run(p.name, p.categoryId, p.price, p.cost, p.minStock, p.active ? 1 : 0).lastInsertRowid);
    audit(db, req.user!.id, 'crear', 'producto', id, p);
    res.status(201).json(toOwner(get(id)!));
  }));

  // RF-13 / RF-14: editar o desactivar (nunca se borra). El stock no se edita aquí.
  r.patch('/:id', requireRole('dueno'), route((req, res) => {
    const id = Number(req.params.id);
    const before = get(id);
    if (!before) throw httpError(404, 'Producto no encontrado');
    const p = ProductInput.parse({ ...toOwner(before), ...req.body });
    assertCategory(p.categoryId);
    db.prepare('UPDATE products SET name = ?, category_id = ?, price = ?, cost = ?, min_stock = ?, active = ? WHERE id = ?')
      .run(p.name, p.categoryId, p.price, p.cost, p.minStock, p.active ? 1 : 0, id);
    audit(db, req.user!.id, 'editar', 'producto', id, { antes: toOwner(before), despues: p });
    res.json(toOwner(get(id)!));
  }));

  return r;
}
