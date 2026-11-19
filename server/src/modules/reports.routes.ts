import { Router } from 'express';
import { DateRange, estimatedProfit, type SummaryReport } from '@mirador/shared';
import type { DB } from '../db/index';
import { requireAuth, requireRole } from '../lib/auth';
import { route } from '../lib/http';

/** Facturas no anuladas del rango, por fecha local (YYYY-MM-DD). */
const PAID = `FROM invoices inv JOIN accounts a ON a.id = inv.account_id
  WHERE inv.voided_at IS NULL AND date(inv.created_at, 'localtime') BETWEEN @from AND @to`;

export function reportRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth, requireRole('dueno'));

  // RF-58 a RF-60: ventas, costo de lo vendido, surtido, otros gastos y utilidad estimada
  r.get('/summary', route((req, res) => {
    const { from, to } = DateRange.parse(req.query);
    const p = { from, to };

    const sales = (db.prepare(`SELECT COALESCE(SUM(inv.subtotal - inv.discount), 0) AS v, COUNT(*) AS n ${PAID}`).get(p) as { v: number; n: number });
    const cost = (db.prepare(`SELECT COALESCE(SUM(i.qty * i.unit_cost), 0) AS v ${PAID.replace('WHERE', `JOIN rounds r ON r.account_id = a.id JOIN round_items i ON i.round_id = r.id WHERE i.voided_at IS NULL AND`)}`).get(p) as { v: number }).v;
    const expenses = (db.prepare('SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE date BETWEEN @from AND @to').get(p) as { v: number }).v;
    const purchases = (db.prepare('SELECT COALESCE(SUM(total), 0) AS v FROM purchases WHERE date BETWEEN @from AND @to').get(p) as { v: number }).v;

    const byDay = db.prepare(`SELECT date(inv.created_at, 'localtime') AS d, SUM(inv.subtotal - inv.discount) AS v ${PAID} GROUP BY d ORDER BY d`).all(p) as { d: string; v: number }[];
    // Todos los días del rango, también los que no tuvieron ventas
    const salesByDay: SummaryReport['salesByDay'] = [];
    for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`) && salesByDay.length < 62; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      salesByDay.push({ date: key, sales: byDay.find((x) => x.d === key)?.v ?? 0 });
    }

    const topProducts = (db.prepare(`SELECT pr.id, pr.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS sales
      ${PAID.replace('WHERE', `JOIN rounds r ON r.account_id = a.id JOIN round_items i ON i.round_id = r.id JOIN products pr ON pr.id = i.product_id WHERE i.voided_at IS NULL AND`)}
      GROUP BY pr.id ORDER BY qty DESC, sales DESC LIMIT 5`).all(p) as { id: number; name: string; qty: number; sales: number }[])
      .map((x) => ({ productId: x.id, name: x.name, qty: x.qty, sales: x.sales }));

    const salesByWaiter = (db.prepare(`SELECT u.name AS waiter, SUM(inv.subtotal - inv.discount) AS sales, COUNT(*) AS invoices
      ${PAID.replace('WHERE', 'JOIN users u ON u.id = a.waiter_id WHERE')} GROUP BY u.id ORDER BY sales DESC`).all(p) as SummaryReport['salesByWaiter']);

    const margins = (db.prepare('SELECT id, name, price, cost FROM products WHERE active = 1 ORDER BY (price - cost) DESC').all() as { id: number; name: string; price: number; cost: number }[])
      .map((x) => ({ productId: x.id, name: x.name, price: x.price, cost: x.cost, margin: x.price - x.cost }));

    const out: SummaryReport = {
      from, to, sales: sales.v, invoices: sales.n, costOfSales: cost, otherExpenses: expenses, purchases,
      profit: estimatedProfit(sales.v, cost, expenses), salesByDay, topProducts, salesByWaiter, margins,
    };
    res.json(out);
  }));

  return r;
}
