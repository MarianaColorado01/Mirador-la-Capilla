import { Router } from 'express';
import { SettingsPatchSchema } from '@mirador/shared';
import { getSettings, saveSettings, type DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { route } from '../lib/http';

export function settingsRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db));

  // Todos los perfiles leen impuesto, propina, modo un solo operador e inactividad (RF-04, RF-09).
  r.get('/', (_req, res) => {
    res.json(getSettings(db));
  });

  // RF-04: solo el dueño cambia los ajustes.
  r.patch('/', requireRole(), route((req, res) => {
    const patch = SettingsPatchSchema.parse(req.body);
    db.transaction(() => {
      saveSettings(db, patch);
      audit(db, req.user!.id, 'editar', 'ajustes', null, patch);
    })();
    res.json(getSettings(db));
  }));

  return r;
}
