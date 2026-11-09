import { Router } from 'express';
import type { Product, ProductOwnerView } from '@mirador/shared';
import type { DB } from '../db/index';
import { requireAuth } from '../lib/auth';
import { httpError, route } from '../lib/http';

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

  // RF-10 / RF-11: listado activo, con búsqueda y filtro por categoría
  r.get('/', route((req, res) => {
    const q = String(req.query.q ?? '').trim();
    const cat = Number(req.query.categoryId) || null;
    const rows = db.prepare(`${SELECT} WHERE p.active = 1
      AND (@q = '' OR p.name LIKE '%' || @q || '%')
      AND (@cat IS NULL OR p.category_id = @cat)
      ORDER BY c.name, p.name`).all({ q, cat }) as Row[];
    res.json(req.user!.role === 'dueno' ? rows.map(toOwner) : rows.map(toProduct));
  }));

  // RF-12: detalle; el dueño ve costo y margen. Id inexistente → 404 con mensaje.
  r.get('/:id', route((req, res) => {
    const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(Number(req.params.id)) as Row | undefined;
    if (!row) throw httpError(404, 'Producto no encontrado');
    res.json(req.user!.role === 'dueno' ? toOwner(row) : toProduct(row));
  }));

  return r;
}
