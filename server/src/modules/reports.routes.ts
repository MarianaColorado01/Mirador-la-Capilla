import { Router } from 'express';
import { DateRangeSchema } from '@mirador/shared';
import type { DB } from '../db/index';
import { requireAuth, requireRole } from '../lib/auth';
import { route } from '../lib/http';
import { loadSummary } from '../services/views';

/** Reportes (RF-58, RF-59). Solo el dueño. */
export function reportRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  // ?from=&to= son días locales AAAA-MM-DD; la app los calcula para Hoy / Semana / Mes.
  r.get('/summary', route((req, res) => {
    const { from, to } = DateRangeSchema.parse(req.query);
    res.json(loadSummary(db, from, to));
  }));

  return r;
}
