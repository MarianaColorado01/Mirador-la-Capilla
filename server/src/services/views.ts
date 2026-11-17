/* Lecturas que arman los objetos que ve la app. Solo SELECT; nada de reglas aquí. */
import { estimatedProfit, type Account, type BarTicket, type Expense, type Invoice, type InvoicePayment, type Purchase, type PurchaseListItem, type ReportSummary, type Round, type RoundItem, type RoundStatus } from '@mirador/shared';
import type { DB } from '../db/index';

interface ItemRow {
  id: number; round_id: number; product_id: number; product_name: string; qty: number; unit_price: number; note: string | null;
  voided_at: string | null; voided_by_name: string | null; void_reason: string | null; void_restocked: number | null;
}

const ITEMS_SQL = `SELECT i.*, p.name AS product_name, u.name AS voided_by_name
  FROM round_items i JOIN products p ON p.id = i.product_id LEFT JOIN users u ON u.id = i.voided_by`;

/** SQLite guarda 'YYYY-MM-DD HH:MM:SS' en UTC; la app recibe ISO. */
export const iso = (s: string) => (s.includes('T') ? s : s.replace(' ', 'T') + 'Z');

const toItem = (r: ItemRow): RoundItem => ({
  id: r.id, productId: r.product_id, productName: r.product_name, qty: r.qty, unitPrice: r.unit_price, note: r.note,
  voided: r.voided_at ? { by: r.voided_by_name ?? '', at: iso(r.voided_at), reason: r.void_reason ?? '', restocked: !!r.void_restocked } : null,
});

export function itemsOfRounds(db: DB, roundIds: number[]): Map<number, RoundItem[]> {
  const map = new Map<number, RoundItem[]>(roundIds.map((id) => [id, []]));
  if (!roundIds.length) return map;
  const rows = db.prepare(`${ITEMS_SQL} WHERE i.round_id IN (${roundIds.map(() => '?').join(',')}) ORDER BY i.id`).all(...roundIds) as ItemRow[];
  for (const r of rows) map.get(r.round_id)!.push(toItem(r));
  return map;
}

export function subtotalOf(db: DB, accountId: number): number {
  const { s } = db.prepare(`SELECT COALESCE(SUM(i.qty * i.unit_price), 0) AS s FROM round_items i
    JOIN rounds r ON r.id = i.round_id WHERE r.account_id = ? AND i.voided_at IS NULL`).get(accountId) as { s: number };
  return s;
}

export function loadAccount(db: DB, id: number): Account | null {
  const a = db.prepare(`SELECT a.*, t.number AS table_number, u.name AS waiter, inv.id AS invoice_id
    FROM accounts a JOIN tables t ON t.id = a.table_id JOIN users u ON u.id = a.waiter_id
    LEFT JOIN invoices inv ON inv.account_id = a.id WHERE a.id = ?`).get(id) as
    | { id: number; table_number: number; waiter: string; status: Account['status']; opened_at: string; invoice_id: number | null; merged_into: number | null }
    | undefined;
  if (!a) return null;
  const rounds = db.prepare(`SELECT r.*, u.name AS taken_by_name FROM rounds r JOIN users u ON u.id = r.taken_by
    WHERE r.account_id = ? ORDER BY r.number`).all(id) as { id: number; number: number; status: RoundStatus; taken_by_name: string; created_at: string }[];
  const items = itemsOfRounds(db, rounds.map((r) => r.id));
  return {
    id: a.id, tableNumber: a.table_number, waiter: a.waiter, status: a.status, openedAt: iso(a.opened_at),
    subtotal: subtotalOf(db, a.id), invoiceId: a.invoice_id, mergedInto: a.merged_into,
    rounds: rounds.map<Round>((r) => ({ id: r.id, number: r.number, status: r.status, takenBy: r.taken_by_name, createdAt: iso(r.created_at), items: items.get(r.id)! })),
  };
}

export function barQueue(db: DB, statuses: RoundStatus[]): BarTicket[] {
  const rows = db.prepare(`SELECT r.*, a.id AS account_id, t.number AS table_number, u.name AS taken_by_name
    FROM rounds r JOIN accounts a ON a.id = r.account_id JOIN tables t ON t.id = a.table_id JOIN users u ON u.id = r.taken_by
    WHERE r.status IN (${statuses.map(() => '?').join(',')}) AND a.status != 'pagada'
    ORDER BY r.created_at, r.id`).all(...statuses) as { id: number; number: number; status: RoundStatus; created_at: string; account_id: number; table_number: number; taken_by_name: string }[];
  const items = itemsOfRounds(db, rows.map((r) => r.id));
  return rows.map((r) => ({
    roundId: r.id, roundNumber: r.number, accountId: r.account_id, tableNumber: r.table_number, takenBy: r.taken_by_name,
    status: r.status, createdAt: iso(r.created_at), items: items.get(r.id)!,
  }));
}

export function loadInvoice(db: DB, id: number): Invoice | null {
  const v = db.prepare(`SELECT inv.*, t.number AS table_number, w.name AS waiter, c.name AS cashier, vb.name AS voided_by_name
    FROM invoices inv JOIN accounts a ON a.id = inv.account_id JOIN tables t ON t.id = a.table_id
    JOIN users w ON w.id = a.waiter_id JOIN users c ON c.id = inv.cashier_id LEFT JOIN users vb ON vb.id = inv.voided_by
    WHERE inv.id = ?`).get(id) as
    | {
        id: number; number: number; account_id: number; table_number: number; waiter: string; cashier: string; subtotal: number; discount: number;
        tip_percent: number; tip: number; tax_percent: number; tax: number; total: number;
        created_at: string; voided_at: string | null; voided_by_name: string | null; void_reason: string | null;
      }
    | undefined;
  if (!v) return null;
  const roundIds = (db.prepare('SELECT id FROM rounds WHERE account_id = ? ORDER BY number').all(v.account_id) as { id: number }[]).map((r) => r.id);
  const items = [...itemsOfRounds(db, roundIds).values()].flat();
  const payments = db.prepare('SELECT method, amount, received, change FROM payments WHERE invoice_id = ? ORDER BY id').all(id) as InvoicePayment[];
  return {
    id: v.id, number: v.number, accountId: v.account_id, tableNumber: v.table_number, waiter: v.waiter, cashier: v.cashier,
    subtotal: v.subtotal, discount: v.discount, tipPercent: v.tip_percent, tip: v.tip, taxPercent: v.tax_percent, tax: v.tax, total: v.total,
    method: payments.length === 1 ? payments[0]!.method : 'mixto', payments, createdAt: iso(v.created_at),
    voided: v.voided_at ? { at: iso(v.voided_at), by: v.voided_by_name ?? '', reason: v.void_reason ?? '' } : null,
    items,
  };
}

type PurchaseRow = { id: number; supplier_id: number; supplier_name: string; date: string; total: number; item_count: number; user: string; created_at: string };

/** RF-55: compras con proveedor, usuario y número de ítems. `where` usa parámetros con nombre. */
export function listPurchases(db: DB, where: string, params: Record<string, unknown>): PurchaseListItem[] {
  const rows = db.prepare(`SELECT pu.id, pu.supplier_id, s.name AS supplier_name, pu.date, pu.total, u.name AS user, pu.created_at,
      (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = pu.id) AS item_count
    FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id JOIN users u ON u.id = pu.user_id
    WHERE ${where} ORDER BY pu.date DESC, pu.id DESC LIMIT 200`).all(params) as PurchaseRow[];
  return rows.map((r) => ({
    id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name, date: r.date, total: r.total,
    itemCount: r.item_count, user: r.user, createdAt: iso(r.created_at),
  }));
}

export function loadPurchase(db: DB, id: number): Purchase | null {
  const [head] = listPurchases(db, 'pu.id = @id', { id });
  if (!head) return null;
  const items = db.prepare(`SELECT i.id, i.product_id AS productId, p.name, i.qty, i.unit_cost AS unitCost, i.qty * i.unit_cost AS total
    FROM purchase_items i JOIN products p ON p.id = i.product_id WHERE i.purchase_id = ? ORDER BY i.id`).all(id) as Purchase['items'];
  return { ...head, items };
}

/** RF-57: gastos del rango (días locales, ambos incluidos), el más reciente primero. */
export function listExpenses(db: DB, from: string, to: string): Expense[] {
  const rows = db.prepare(`SELECT e.id, e.concept, e.amount, e.date, u.name AS user, e.created_at FROM expenses e JOIN users u ON u.id = e.user_id
    WHERE e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.id DESC`).all(from, to) as { id: number; concept: string; amount: number; date: string; user: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, concept: r.concept, amount: r.amount, date: r.date, user: r.user, createdAt: iso(r.created_at) }));
}

/**
 * RF-58 / RF-59: ventas salen de facturas no anuladas, nunca del estado de la cuenta (una cuenta unida
 * queda pagada sin factura y sus rondas ya están en la otra). Las fechas de SQLite son UTC: el día es el local.
 */
export function loadSummary(db: DB, from: string, to: string): ReportSummary {
  const p = { from, to };
  const INV = `FROM invoices inv JOIN accounts a ON a.id = inv.account_id
    WHERE inv.voided_at IS NULL AND date(inv.created_at, 'localtime') BETWEEN @from AND @to`;
  const ITEMS = `FROM round_items i JOIN rounds r ON r.id = i.round_id JOIN invoices inv ON inv.account_id = r.account_id
    WHERE i.voided_at IS NULL AND inv.voided_at IS NULL AND date(inv.created_at, 'localtime') BETWEEN @from AND @to`;
  const t = db.prepare(`SELECT COALESCE(SUM(inv.subtotal - inv.discount), 0) AS sales, COALESCE(SUM(inv.tip), 0) AS tips,
    COALESCE(SUM(inv.tax), 0) AS taxes, COUNT(*) AS n ${INV}`).get(p) as { sales: number; tips: number; taxes: number; n: number };
  const cost = (db.prepare(`SELECT COALESCE(SUM(i.qty * i.unit_cost), 0) AS v ${ITEMS}`).get(p) as { v: number }).v;
  const purchases = (db.prepare('SELECT COALESCE(SUM(total), 0) AS v FROM purchases WHERE date BETWEEN @from AND @to').get(p) as { v: number }).v;
  const otherExpenses = (db.prepare('SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE date BETWEEN @from AND @to').get(p) as { v: number }).v;
  return {
    from, to,
    sales: t.sales, tips: t.tips, taxes: t.taxes, costOfSales: cost, purchases, otherExpenses,
    profit: estimatedProfit(t.sales, cost, otherExpenses),
    invoiceCount: t.n,
    averageTicket: t.n ? Math.round(t.sales / t.n) : 0,
    byDay: db.prepare(`SELECT date(inv.created_at, 'localtime') AS date, SUM(inv.subtotal - inv.discount) AS sales ${INV} GROUP BY 1 ORDER BY 1`).all(p) as ReportSummary['byDay'],
    topProducts: db.prepare(`SELECT i.product_id AS productId, pr.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS amount
      ${ITEMS.replace('WHERE', 'JOIN products pr ON pr.id = i.product_id WHERE')} GROUP BY i.product_id ORDER BY qty DESC, amount DESC LIMIT 10`).all(p) as ReportSummary['topProducts'],
    byWaiter: db.prepare(`SELECT a.waiter_id AS waiterId, u.name, SUM(inv.subtotal - inv.discount) AS sales, COUNT(*) AS invoices
      ${INV.replace('WHERE', 'JOIN users u ON u.id = a.waiter_id WHERE')} GROUP BY a.waiter_id ORDER BY sales DESC`).all(p) as ReportSummary['byWaiter'],
  };
}
