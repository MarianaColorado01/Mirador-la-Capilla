import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { UserCreateSchema, UserUpdateSchema, type ManagedUser } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { httpError, route } from '../lib/http';

type Row = { id: number; name: string; role: ManagedUser['role']; active: number };
const view = (u: Row): ManagedUser => ({ id: u.id, name: u.name, role: u.role, active: !!u.active });

/** RF-07: el dueño crea, edita y desactiva usuarios. Nunca se borran (RN-04). */
export function userRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  const load = (id: number | bigint) => db.prepare('SELECT id, name, role, active FROM users WHERE id = ?').get(id) as Row | undefined;

  // Reglas que se revisan con el cambio ya aplicado, dentro de la transacción: si fallan, no queda nada.
  const check = (u: Row) => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'dueno' AND active = 1").get() as { n: number };
    if (n === 0) throw httpError(409, 'Debe quedar al menos un dueño activo');
    const twin = db.prepare('SELECT 1 FROM users WHERE active = 1 AND id != ? AND lower(name) = lower(?)').get(u.id, u.name);
    if (u.active && twin) throw httpError(409, `Ya hay un perfil activo llamado ${u.name}`, 'name');
  };

  r.get('/', route((_req, res) => {
    const rows = db.prepare('SELECT id, name, role, active FROM users ORDER BY active DESC, id').all() as Row[];
    res.json(rows.map(view));
  }));

  r.post('/', route((req, res) => {
    const { name, role, pin } = UserCreateSchema.parse(req.body);
    const user = db.transaction(() => {
      const id = db.prepare('INSERT INTO users(name, role, pin_hash) VALUES(?, ?, ?)').run(name, role, bcrypt.hashSync(pin, 10)).lastInsertRowid;
      const u = load(id)!;
      check(u);
      audit(db, req.user!.id, 'crear', 'usuario', id, { name, role });
      return u;
    })();
    res.status(201).json(view(user));
  }));

  r.patch('/:id', route((req, res) => {
    const body = UserUpdateSchema.parse(req.body);
    const id = Number(req.params.id);
    if (id === req.user!.id && body.active === false) throw httpError(409, 'No puedes desactivar tu propio perfil', 'active');
    const user = db.transaction(() => {
      if (!load(id)) throw httpError(404, 'Usuario no encontrado');
      if (body.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name, id);
      if (body.role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, id);
      if (body.active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
      // Un PIN nuevo también quita el bloqueo por intentos fallidos (RF-08).
      if (body.pin !== undefined)
        db.prepare('UPDATE users SET pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(bcrypt.hashSync(body.pin, 10), id);
      const u = load(id)!;
      check(u);
      const { pin, ...changes } = body;
      audit(db, req.user!.id, 'editar', 'usuario', id, { ...changes, pinChanged: pin !== undefined });
      return u;
    })();
    res.json(view(user));
  }));

  return r;
}
