import { Router } from 'express';
import { SupplierSchema, SupplierUpdateSchema, type Supplier } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';

type Row = Omit<Supplier, 'active'> & { active: number };
const view = (s: Row): Supplier => ({ ...s, active: !!s.active });
const SELECT = 'SELECT id, name, phone, notes, address, lat, lng, active FROM suppliers';

/** RF-52: el dueño registra, edita y desactiva proveedores. Nunca se borran (RN-04). */
export function supplierRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  const load = (id: number | bigint) => db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined;

  r.get('/', route((_req, res) => {
    res.json((db.prepare(`${SELECT} ORDER BY active DESC, name`).all() as Row[]).map(view));
  }));

  r.get('/:id', route((req, res) => {
    const row = load(Number(req.params.id));
    if (!row) throw httpError(404, 'Proveedor no encontrado');
    res.json(view(row));
  }));

  r.post('/', route((req, res) => {
    const s = SupplierSchema.parse(req.body);
    const row = db.transaction(() => {
      const id = db.prepare('INSERT INTO suppliers(name, phone, notes, address, lat, lng) VALUES(?, ?, ?, ?, ?, ?)')
        .run(s.name, s.phone || null, s.notes || null, s.address || null, s.lat ?? null, s.lng ?? null).lastInsertRowid;
      audit(db, req.user!.id, 'crear', 'proveedor', id, s);
      return load(id)!;
    })();
    res.status(201).json(view(row));
  }));

  r.patch('/:id', route((req, res) => {
    const body = SupplierUpdateSchema.parse(req.body);
    const id = Number(req.params.id);
    const row = db.transaction(() => {
      if (!load(id)) throw httpError(404, 'Proveedor no encontrado');
      const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
      const cols = { name: body.name, phone: text(body.phone), notes: text(body.notes), address: text(body.address),
        lat: body.lat, lng: body.lng, active: body.active === undefined ? undefined : body.active ? 1 : 0 };
      for (const [col, v] of Object.entries(cols)) if (v !== undefined) db.prepare(`UPDATE suppliers SET ${col} = ? WHERE id = ?`).run(v, id);
      audit(db, req.user!.id, 'editar', 'proveedor', id, body);
      return load(id)!;
    })();
    res.json(view(row));
  }));

  return r;
}
