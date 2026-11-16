import { Router } from 'express';
import { CategorySchema, CategoryUpdateSchema, type Category } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';

type Row = { id: number; name: string; active: number };
const view = (c: Row): Category => ({ id: c.id, name: c.name, active: !!c.active });

/** RF-15: el dueño crea, renombra y desactiva categorías. Nunca se borran (RN-04). */
export function categoryRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  const load = (id: number | bigint) => db.prepare('SELECT id, name, active FROM categories WHERE id = ?').get(id) as Row | undefined;
  const checkName = (name: string, id: number | null) => {
    if (db.prepare('SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id IS NOT ?').get(name, id))
      throw httpError(409, `Ya existe la categoría ${name}`, 'name');
  };

  r.get('/', route((_req, res) => {
    res.json((db.prepare('SELECT id, name, active FROM categories ORDER BY active DESC, name').all() as Row[]).map(view));
  }));

  r.post('/', route((req, res) => {
    const { name } = CategorySchema.parse(req.body);
    const row = db.transaction(() => {
      checkName(name, null);
      const id = db.prepare('INSERT INTO categories(name) VALUES(?)').run(name).lastInsertRowid;
      audit(db, req.user!.id, 'crear', 'categoria', id, { name });
      return load(id)!;
    })();
    res.status(201).json(view(row));
  }));

  r.patch('/:id', route((req, res) => {
    const body = CategoryUpdateSchema.parse(req.body);
    const id = Number(req.params.id);
    const row = db.transaction(() => {
      if (!load(id)) throw httpError(404, 'Categoría no encontrada');
      if (body.name !== undefined) {
        checkName(body.name, id);
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(body.name, id);
      }
      if (body.active === false) {
        // Sin esto sus productos seguirían a la venta dentro de una categoría que ya no existe para el dueño.
        const { n } = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND active = 1').get(id) as { n: number };
        if (n > 0) throw httpError(409, `Tiene ${n} ${n === 1 ? 'producto activo' : 'productos activos'}: desactívalos o cámbialos de categoría primero`, 'active');
      }
      if (body.active !== undefined) db.prepare('UPDATE categories SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
      audit(db, req.user!.id, 'editar', 'categoria', id, body);
      return load(id)!;
    })();
    res.json(view(row));
  }));

  return r;
}
