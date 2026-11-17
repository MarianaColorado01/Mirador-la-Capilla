import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { backupPath, createBackup, listBackups, restoreBackup } from '../lib/backups';
import type { Emit } from '../lib/events';
import { route } from '../lib/http';

const RestoreSchema = z.object({
  confirm: z.literal('RESTAURAR', { error: 'Escribe RESTAURAR para confirmar' }),
});

/** RF-71: copias de la base. Todo es solo del dueño (RN-09). */
export function backupRoutes(db: DB, emit: Emit, dir: string) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  r.get('/', (_req, res) => {
    res.json(listBackups(dir));
  });

  r.post('/', route(async (req, res) => {
    const id = await createBackup(db, dir, 'manual');
    audit(db, req.user!.id, 'crear', 'respaldo', null, { id });
    res.status(201).json(listBackups(dir).find((b) => b.id === id));
  }));

  // Exportar: el celular descarga el archivo y lo comparte.
  r.get('/:id/download', (req, res, next) => {
    try {
      res.download(backupPath(dir, req.params.id), req.params.id, (e) => e && !res.headersSent && next(e));
    } catch (e) {
      next(e);
    }
  });

  r.post('/:id/restore', route(async (req, res) => {
    const id = String(req.params.id);
    RestoreSchema.parse(req.body ?? {});
    const user = req.user!;
    const { safety } = await restoreBackup(db, dir, id, (safetyId) => {
      // Tras copiar, los usuarios son los de la copia: si el dueño no existía en esa fecha, va sin usuario.
      const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(user.id);
      audit(db, exists ? user.id : null, 'restaurar', 'respaldo', null, { id, safety: safetyId, by: user.name });
    });
    emit('datos:restaurados', { backupId: id });
    res.json({ restored: id, safety });
  }));

  return r;
}
