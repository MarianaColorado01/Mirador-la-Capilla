import { Router } from 'express';
import { DateRangeSchema, ExpenseSchema } from '@mirador/shared';
import type { DB } from '../db/index';
import { audit } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/auth';
import { route } from '../lib/http';
import { listExpenses } from '../services/views';

/** Gastos adicionales (RF-57). Solo el dueño. Sin borrar ni editar (RN-04): no hay ruta para eso. */
export function expenseRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth(db), requireRole());

  // ?from=&to= (AAAA-MM-DD, ambos incluidos).
  r.get('/', route((req, res) => {
    const { from, to } = DateRangeSchema.parse(req.query);
    res.json(listExpenses(db, from, to));
  }));

  r.post('/', route((req, res) => {
    const b = ExpenseSchema.parse(req.body);
    const userId = req.user!.id;
    const id = db.transaction(() => {
      const id = Number(db.prepare('INSERT INTO expenses(concept, amount, date, user_id) VALUES(?, ?, ?, ?)').run(b.concept, b.amount, b.date, userId).lastInsertRowid);
      audit(db, userId, 'crear', 'gasto', id, b);
      return id;
    })();
    res.status(201).json(listExpenses(db, b.date, b.date).find((e) => e.id === id));
  }));

  return r;
}
