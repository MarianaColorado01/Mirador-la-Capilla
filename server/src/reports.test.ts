/* Gastos (RF-57) y resumen del negocio (RF-58 a RF-59, sección 4.3). */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDate } from '@mirador/shared';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
let keySeq = 0;

const id = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { id: number }).id;
const pid = (name: string) => id('SELECT id FROM products WHERE name = ?', name);
const uid = (name: string) => id('SELECT id FROM users WHERE name = ?', name);

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object = {}) =>
    request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`).set('Idempotency-Key', `reporte-${++keySeq}-xxxxxxxx`).send(body),
});
const summary = (from: string, to = from) => as('Dueño').get(`/reports/summary?from=${from}&to=${to}`);

/** Hora local → texto UTC como lo guarda SQLite con datetime('now'). */
const utc = (local: string) => new Date(local).toISOString().slice(0, 19).replace('T', ' ');

let invoiceNumber = 100;
/** Venta cobrada con datos controlados: precio y costo congelados en cada ítem (RN-03). */
function sale(o: {
  at: string; waiter?: string; discount?: number; tip?: number; tax?: number; voided?: boolean;
  items: { product: string; qty: number; price: number; cost: number; voided?: boolean }[];
}) {
  const table = id('SELECT id FROM tables ORDER BY id LIMIT 1');
  const acc = Number(db.prepare("INSERT INTO accounts(table_id, waiter_id, status) VALUES(?, ?, 'pagada')").run(table, uid(o.waiter ?? 'Ana')).lastInsertRowid);
  const round = Number(db.prepare("INSERT INTO rounds(account_id, number, status, taken_by) VALUES(?, 1, 'entregado', ?)").run(acc, uid(o.waiter ?? 'Ana')).lastInsertRowid);
  for (const i of o.items)
    db.prepare('INSERT INTO round_items(round_id, product_id, qty, unit_price, unit_cost, voided_at) VALUES(?, ?, ?, ?, ?, ?)')
      .run(round, pid(i.product), i.qty, i.price, i.cost, i.voided ? utc(o.at) : null);
  const subtotal = o.items.filter((i) => !i.voided).reduce((t, i) => t + i.qty * i.price, 0);
  const [discount, tip, tax] = [o.discount ?? 0, o.tip ?? 0, o.tax ?? 0];
  db.prepare(`INSERT INTO invoices(number, account_id, subtotal, discount, tip, tax, total, cashier_id, created_at, voided_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(++invoiceNumber, acc, subtotal, discount, tip, tax, subtotal - discount + tip + tax, uid('Cajero'), utc(o.at), o.voided ? utc(o.at) : null);
  return acc;
}

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  for (const u of db.prepare('SELECT id, name FROM users').all() as { id: number; name: string }[]) {
    tokens[u.name] = (await request(app).post('/auth/login').send({ userId: u.id, pin: DEMO_PIN })).body.token;
  }
});

describe('gastos (RF-57)', () => {
  it('solo el dueño registra y lista gastos (RN-09)', async () => {
    for (const who of ['Ana', 'Cajero', 'Operador', 'Preparador']) {
      expect((await as(who).get(`/expenses?from=${localDate()}&to=${localDate()}`)).status).toBe(403);
      expect((await as(who).post('/expenses', { concept: 'Hielo', amount: 10000, date: localDate() })).status).toBe(403);
      expect((await as(who).get(`/reports/summary?from=${localDate()}&to=${localDate()}`)).status).toBe(403);
    }
  });

  it('registra con auditoría y lista por rango de fechas', async () => {
    const r = await as('Dueño').post('/expenses', { concept: '  Hielo ', amount: 10000, date: '2026-03-10' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: expect.any(Number), concept: 'Hielo', amount: 10000, date: '2026-03-10', user: 'Dueño', createdAt: expect.any(String) });
    await as('Dueño').post('/expenses', { concept: 'Gas', amount: 15000, date: '2026-03-12' });
    expect((await as('Dueño').get('/expenses?from=2026-03-10&to=2026-03-11')).body.map((e: { concept: string }) => e.concept)).toEqual(['Hielo']);
    expect((await as('Dueño').get('/expenses?from=2026-03-01&to=2026-03-31')).body.map((e: { concept: string }) => e.concept)).toEqual(['Gas', 'Hielo']);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'gasto'").get()).toEqual({ n: 2 });
  });

  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d); };
  it.each([
    [{ concept: '', amount: 1000, date: '2026-03-10' }, 'concept'],
    [{ concept: 'Hielo', amount: 0, date: '2026-03-10' }, 'amount'],
    [{ concept: 'Hielo', amount: -500, date: '2026-03-10' }, 'amount'],
    [{ concept: 'Hielo', amount: 1500.5, date: '2026-03-10' }, 'amount'],
    [{ concept: 'Hielo', amount: 1000, date: '2026-02-30' }, 'date'],
    [{ concept: 'Hielo', amount: 1000, date: 'futuro' }, 'date'],
  ])('rechaza %o con el campo que falló', async (body, field) => {
    const r = await as('Dueño').post('/expenses', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('rechaza una fecha futura sin guardar nada', async () => {
    const r = await as('Dueño').post('/expenses', { concept: 'Hielo', amount: 1000, date: tomorrow() });
    expect(r.body).toMatchObject({ field: 'date', error: 'La fecha no puede ser futura' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM expenses').get()).toEqual({ n: 0 });
  });
});

describe('resumen (RF-58, RF-59, sección 4.3)', () => {
  it('cuadra el ejemplo del documento: $1.250.000 − $620.000 − $40.000 = $590.000', async () => {
    sale({ at: '2026-03-10T20:00:00', waiter: 'Ana', items: [
      { product: 'Águila 330 ml', qty: 10, price: 100000, cost: 50000 },
      { product: 'Águila 330 ml', qty: 1, price: 100000, cost: 50000, voided: true }, // ítem anulado: ni venta ni costo
    ] });
    // Propina e impuesto no son ventas; el descuento sí se resta.
    sale({ at: '2026-03-10T21:00:00', waiter: 'Luis', discount: 50000, tip: 25000, tax: 20000, items: [{ product: 'Club Colombia', qty: 5, price: 60000, cost: 24000 }] });
    // Factura anulada: fuera de todo.
    sale({ at: '2026-03-10T22:00:00', voided: true, items: [{ product: 'Michelada', qty: 9, price: 111000, cost: 1000 }] });
    await as('Dueño').post('/expenses', { concept: 'Hielo', amount: 25000, date: '2026-03-10' });
    await as('Dueño').post('/expenses', { concept: 'Gas', amount: 15000, date: '2026-03-10' });

    const r = await summary('2026-03-10');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      sales: 1250000, costOfSales: 620000, otherExpenses: 40000, profit: 590000,
      tips: 25000, taxes: 20000, purchases: 0, invoiceCount: 2, averageTicket: 625000,
      byDay: [{ date: '2026-03-10', sales: 1250000 }],
      topProducts: [
        { productId: pid('Águila 330 ml'), name: 'Águila 330 ml', qty: 10, amount: 1000000 },
        { productId: pid('Club Colombia'), name: 'Club Colombia', qty: 5, amount: 300000 },
      ],
      byWaiter: [{ name: 'Ana', sales: 1000000, invoices: 1 }, { name: 'Luis', sales: 250000, invoices: 1 }],
    });
  });

  it('la compra entra en «gasto en surtido» sin restarse de la utilidad', async () => {
    sale({ at: `${localDate()}T12:00:00`, items: [{ product: 'Águila 330 ml', qty: 2, price: 4000, cost: 2500 }] });
    const before = (await summary(localDate())).body;
    const supplierId = id("SELECT id FROM suppliers WHERE name = 'Distribuidora X'");
    expect((await as('Dueño').post('/purchases', { supplierId, date: localDate(), items: [{ productId: pid('Águila 330 ml'), qty: 24, unitCost: 2500 }] })).status).toBe(201);
    const after = (await summary(localDate())).body;
    expect(after.purchases).toBe(before.purchases + 60000);
    expect(after.profit).toBe(before.profit);
    expect(after.profit).toBe(8000 - 5000);
  });

  it('una cuenta unida no duplica ventas ni costo (flujo real)', async () => {
    const open = async (n: number) => (await as('Ana').post('/accounts', { tableNumber: n })).body.id as number;
    const a = await open(1);
    const b = await open(2);
    await as('Ana').post(`/accounts/${a}/rounds`, { items: [{ productId: pid('Águila 330 ml'), qty: 2 }] });
    await as('Ana').post(`/accounts/${b}/rounds`, { items: [{ productId: pid('Club Colombia'), qty: 1 }] });
    expect((await as('Cajero').post(`/accounts/${b}/merge`, { intoAccountId: a })).status).toBe(200);
    await as('Ana').post(`/accounts/${a}/request-bill`);
    expect((await as('Cajero').post(`/accounts/${a}/charge`, { discount: '', tipPercent: '10', method: 'tarjeta' })).status).toBe(201);

    const s = (await summary(localDate())).body;
    expect(s).toMatchObject({ sales: 2 * 4000 + 5000, costOfSales: 2 * 2500 + 3000, invoiceCount: 1 });
    expect(s.tips).toBeGreaterThan(0);
  });

  it('agrupa por día local aunque la hora UTC ya sea del día siguiente', async () => {
    sale({ at: '2026-03-10T23:30:00', items: [{ product: 'Tinto', qty: 1, price: 3000, cost: 1000 }] });
    sale({ at: '2026-03-11T00:30:00', items: [{ product: 'Tinto', qty: 2, price: 3000, cost: 1000 }] });
    expect((await summary('2026-03-10', '2026-03-11')).body.byDay).toEqual([{ date: '2026-03-10', sales: 3000 }, { date: '2026-03-11', sales: 6000 }]);
    expect((await summary('2026-03-10')).body).toMatchObject({ sales: 3000, invoiceCount: 1 });
  });

  it('un rango vacío da ceros', async () => {
    expect((await summary('2020-01-01')).body).toMatchObject({ sales: 0, costOfSales: 0, profit: 0, invoiceCount: 0, averageTicket: 0, byDay: [], topProducts: [], byWaiter: [] });
  });

  it.each([
    ['from=2026-03-11&to=2026-03-10', 'to'],
    ['from=2026-03-10', 'to'],
    ['to=2026-03-10', 'from'],
    ['from=hoy&to=2026-03-10', 'from'],
  ])('rango inválido %s → 400', async (q, field) => {
    const r = await as('Dueño').get(`/reports/summary?${q}`);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
    expect((await as('Dueño').get(`/expenses?${q}`)).status).toBe(400);
  });
});
