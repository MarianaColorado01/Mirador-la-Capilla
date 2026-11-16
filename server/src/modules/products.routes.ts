import { Router } from 'express';
import { ProductSchema, ProductUpdateSchema, type Product, type ProductOwnerView, type StockMovement } from '@mirador/shared';
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
  r.use(requireAuth(db));

  const load = (id: number | bigint) => db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined;
  const checkCategory = (id: number) => {
    const c = db.prepare('SELECT active FROM categories WHERE id = ?').get(id) as { active: number } | undefined;
    if (!c?.active) throw httpError(400, 'Elige una categoría activa', 'categoryId');
  };

  // RF-10 / RF-11: listado activo, con búsqueda y filtro por categoría.
  // RF-14: con ?all=1 el dueño ve también los inactivos para reactivarlos.
  r.get('/', route((req, res) => {
    const q = String(req.query.q ?? '').trim();
    const cat = Number(req.query.categoryId) || null;
    const owner = req.user!.role === 'dueno';
    const all = owner && req.query.all === '1' ? 1 : 0;
    const rows = db.prepare(`${SELECT} WHERE (@all = 1 OR p.active = 1)
      AND (@q = '' OR p.name LIKE '%' || @q || '%')
      AND (@cat IS NULL OR p.category_id = @cat)
      ORDER BY p.active DESC, c.name, p.name`).all({ q, cat, all }) as Row[];
    res.json(owner ? rows.map(toOwner) : rows.map(toProduct));
  }));

  // RF-12: detalle; el dueño ve costo y margen. Id inexistente o no numérico → 404 con mensaje.
  r.get('/:id', route((req, res) => {
    const row = load(Number(req.params.id));
    if (!row) throw httpError(404, 'Producto no encontrado');
    res.json(req.user!.role === 'dueno' ? toOwner(row) : toProduct(row));
  }));

  // RF-12: últimos movimientos de stock (también los usa el inventario). Solo el dueño.
  r.get('/:id/movements', requireRole(), route((req, res) => {
    const id = Number(req.params.id);
    if (!load(id)) throw httpError(404, 'Producto no encontrado');
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const rows = db.prepare(`SELECT m.id, m.type, m.qty, m.reason, m.reference, m.created_at, u.name AS user
      FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.product_id = ? ORDER BY m.id DESC LIMIT ?`).all(id, limit) as
      (Omit<StockMovement, 'createdAt'> & { created_at: string })[];
    res.json(rows.map(({ created_at, ...m }): StockMovement => ({ ...m, createdAt: iso(created_at) })));
  }));

  // RF-13: crear. El stock arranca en 0 y solo sube con una compra o un ajuste (RN-02).
  r.post('/', requireRole(), route((req, res) => {
    const p = ProductSchema.parse(req.body);
    const row = db.transaction(() => {
      checkCategory(p.categoryId);
      const id = db.prepare('INSERT INTO products(name, category_id, price, cost, min_stock, image_url) VALUES(?, ?, ?, ?, ?, ?)')
        .run(p.name, p.categoryId, p.price, p.cost, p.minStock, p.imageUrl || null).lastInsertRowid;
      audit(db, req.user!.id, 'crear', 'producto', id, p);
      return load(id)!;
    })();
    res.status(201).json(toOwner(row));
  }));

  // RF-13 / RF-14: editar lo que cambie; desactivar es `active: false` (RN-04, nada se borra).
  r.patch('/:id', requireRole(), route((req, res) => {
    const body = ProductUpdateSchema.parse(req.body);
    const id = Number(req.params.id);
    const row = db.transaction(() => {
      if (!load(id)) throw httpError(404, 'Producto no encontrado');
      if (body.categoryId !== undefined) checkCategory(body.categoryId);
      const cols = { name: body.name, category_id: body.categoryId, price: body.price, cost: body.cost, min_stock: body.minStock,
        image_url: body.imageUrl === undefined ? undefined : body.imageUrl || null, active: body.active === undefined ? undefined : body.active ? 1 : 0 };
      for (const [col, v] of Object.entries(cols)) if (v !== undefined) db.prepare(`UPDATE products SET ${col} = ? WHERE id = ?`).run(v, id);
      audit(db, req.user!.id, 'editar', 'producto', id, body);
      return load(id)!;
    })();
    res.json(toOwner(row));
  }));

  return r;
}
