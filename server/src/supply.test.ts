/* Fase 4: productos, inventario, surtido, gastos y resumen (RF-12 a RF-15, RF-47 a RF-60). */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pid = (name: string) => (db.prepare('SELECT id FROM products WHERE name = ?').get(name) as { id: number }).id;
const product = (name: string) => db.prepare('SELECT stock, cost FROM products WHERE name = ?').get(name) as { stock: number; cost: number };

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object = {}, headers: Record<string, string> = {}) => request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`).set(headers).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  for (const u of db.prepare('SELECT id, name FROM users').all() as { id: number; name: string }[]) {
    tokens[u.name] = (await request(app).post('/auth/login').send({ userId: u.id, pin: DEMO_PIN })).body.token;
  }
});

describe('productos y categorías', () => {
  it('valida el formulario de producto campo por campo (RF-13)', async () => {
    const r = await as('Dueño').post('/products', { name: 'Vino', categoryId: 1, price: 0, cost: 5000, minStock: 2 });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('price');
    const r2 = await as('Dueño').post('/products', { name: '', categoryId: 1, price: 1, cost: 1, minStock: -1 });
    expect(r2.body.field).toBe('name');
  });

  it('crea con stock 0 y solo el dueño puede hacerlo', async () => {
    expect((await as('Ana').post('/products', { name: 'Vino', categoryId: 1, price: 30000, cost: 18000, minStock: 2 })).status).toBe(403);
    const r = await as('Dueño').post('/products', { name: 'Vino tinto', categoryId: 3, price: 30000, cost: 18000, minStock: 2 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ stock: 0, margin: 12000 });
  });

  it('desactivar no borra: desaparece al tomar pedidos pero el dueño lo sigue viendo (RF-14)', async () => {
    await as('Dueño').patch(`/products/${pid('Mojito')}`, { active: false });
    const mesero = (await as('Ana').get('/products')).body.map((p: { name: string }) => p.name);
    expect(mesero).not.toContain('Mojito');
    const dueno = (await as('Dueño').get('/products?all=1')).body.map((p: { name: string }) => p.name);
    expect(dueno).toContain('Mojito');
  });

  it('categorías: crear, no duplicar, renombrar (RF-15)', async () => {
    const c = await as('Dueño').post('/categories', { name: 'Vinos' });
    expect(c.status).toBe(201);
    expect((await as('Dueño').post('/categories', { name: 'vinos' })).status).toBe(409);
    expect((await as('Dueño').patch(`/categories/${c.body.id}`, { name: 'Vinos y espumosos' })).body.name).toBe('Vinos y espumosos');
  });
});

describe('inventario', () => {
  it('ordena primero lo que está en o bajo el mínimo (RF-47)', async () => {
    const list = (await as('Dueño').get('/inventory')).body as { name: string; low: boolean }[];
    expect(list[0].low).toBe(true);
    expect(list.filter((p) => p.low).map((p) => p.name)).toEqual(expect.arrayContaining(['Aguardiente 1/2', 'Ron botella', 'Mojito']));
  });

  it('ajustes de entrada, salida y conteo, siempre con movimiento (RF-48, RF-49, RN-02)', async () => {
    const id = pid('Ron botella');
    expect((await as('Dueño').post('/inventory/adjustments', { productId: id, type: 'salida', qty: 5, reason: 'Rota' })).body.field).toBe('qty');
    await as('Dueño').post('/inventory/adjustments', { productId: id, type: 'entrada', qty: 4, reason: 'Devolución de proveedor' });
    expect(product('Ron botella').stock).toBe(5);
    await as('Dueño').post('/inventory/adjustments', { productId: id, type: 'ajuste', qty: 3, reason: 'Conteo físico' });
    expect(product('Ron botella').stock).toBe(3);
    const moves = (await as('Dueño').get(`/products/${id}/movements`)).body;
    expect(moves.map((m: { qty: number }) => m.qty)).toEqual([-2, 4, 1]);
    expect(moves[0]).toMatchObject({ type: 'ajuste', reason: 'Conteo físico', user: 'Dueño' });
  });

  it('el mesero no ve el inventario del dueño', async () => {
    expect((await as('Ana').get('/inventory')).status).toBe(403);
  });

  it('sugiere surtir lo que está bajo el mínimo (RF-51)', async () => {
    const s = (await as('Dueño').get('/inventory/suggestions')).body as { name: string; suggestedQty: number }[];
    expect(s.find((x) => x.name === 'Aguardiente 1/2')?.suggestedQty).toBe(8); // mínimo 5 × 2 − 2
  });
});

describe('proveedores y compras', () => {
  it('valida y registra proveedores con coordenadas (RF-52)', async () => {
    const bad = await as('Dueño').post('/suppliers', { name: 'Licores Sur', lat: 5 });
    expect(bad.body.field).toBe('lng');
    const ok = await as('Dueño').post('/suppliers', { name: 'Licores Sur', phone: '300', lat: '4.98', lng: '-75.8' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ lat: 4.98, lng: -75.8 });
  });

  it('la compra sube el stock, actualiza el costo y deja movimiento de entrada (RF-53, RF-54)', async () => {
    const r = await as('Dueño').post('/purchases', {
      supplierId: 1, date: today(),
      items: [{ productId: pid('Águila 330 ml'), qty: 24, unitCost: 2600 }, { productId: pid('Ron botella'), qty: 6, unitCost: 38000 }],
    });
    expect(r.status).toBe(201);
    expect(r.body.total).toBe(24 * 2600 + 6 * 38000);
    expect(product('Águila 330 ml')).toEqual({ stock: 72, cost: 2600 });
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM stock_movements WHERE reference = ?").get(`compra:${r.body.id}`) as { n: number };
    expect(n).toBe(2);
  });

  it('rechaza cantidades no enteras o costos en cero, sin tocar el stock', async () => {
    const r = await as('Dueño').post('/purchases', { supplierId: 1, date: today(), items: [{ productId: 1, qty: 1.5, unitCost: 100 }] });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('items.0.qty');
    expect((await as('Dueño').post('/purchases', { supplierId: 1, date: today(), items: [{ productId: 1, qty: 1, unitCost: 0 }] })).body.field).toBe('items.0.unitCost');
    expect(product('Águila 330 ml').stock).toBe(48);
  });

  it('historial filtrable y reporte por proveedor (RF-55, RF-56)', async () => {
    await as('Dueño').post('/purchases', { supplierId: 1, date: '2026-11-01', items: [{ productId: 1, qty: 10, unitCost: 2500 }] });
    await as('Dueño').post('/purchases', { supplierId: 2, date: '2026-11-03', items: [{ productId: 10, qty: 12, unitCost: 1200 }] });
    expect((await as('Dueño').get('/purchases?supplierId=2')).body).toHaveLength(1);
    expect((await as('Dueño').get('/purchases?from=2026-11-02&to=2026-11-30')).body).toHaveLength(1);
    expect((await as('Dueño').get('/purchases?from=2026-11-30&to=2026-11-01')).status).toBe(400);
    const rep = (await as('Dueño').get('/purchases/by-supplier?from=2026-11-01&to=2026-11-30')).body;
    expect(rep[0]).toMatchObject({ name: 'Distribuidora X', total: 25000, purchases: 1 });
  });
});

describe('gastos y resumen', () => {
  it('valida el gasto (RF-57)', async () => {
    expect((await as('Dueño').post('/expenses', { concept: 'Hielo', amount: 0, date: today() })).body.field).toBe('amount');
    expect((await as('Dueño').post('/expenses', { concept: 'Hielo', amount: 10000, date: today() })).status).toBe(201);
  });

  it('utilidad = ventas − costo de lo vendido − otros gastos; el surtido va aparte (RF-58)', async () => {
    // Venta: 2 Águila (costo 2500) + 1 Aguardiente (costo 30000) = 53.000, sin descuento
    const acc = (await as('Ana').post('/accounts', { tableNumber: 1 })).body;
    await as('Ana').post(`/accounts/${acc.id}/rounds`, { items: [{ productId: pid('Águila 330 ml'), qty: 2 }, { productId: pid('Aguardiente 1/2'), qty: 1 }] }, { 'Idempotency-Key': 'resumen-00000001' });
    await as('Ana').post(`/accounts/${acc.id}/request-bill`);
    await as('Cajero').post(`/accounts/${acc.id}/charge`, { discount: '', tipPercent: '10', method: 'tarjeta' });
    await as('Dueño').post('/expenses', { concept: 'Hielo', amount: 10000, date: today() });
    await as('Dueño').post('/purchases', { supplierId: 1, date: today(), items: [{ productId: 1, qty: 10, unitCost: 2500 }] });

    const s = (await as('Dueño').get(`/reports/summary?from=${today()}&to=${today()}`)).body;
    expect(s).toMatchObject({ sales: 53000, costOfSales: 35000, otherExpenses: 10000, purchases: 25000, profit: 8000, invoices: 1 });
    expect(s.topProducts[0]).toMatchObject({ name: 'Águila 330 ml', qty: 2 });
    expect(s.salesByWaiter).toEqual([{ waiter: 'Ana', sales: 53000, invoices: 1 }]);
    expect(s.salesByDay).toEqual([{ date: today(), sales: 53000 }]);
    expect(s.margins[0].margin).toBeGreaterThanOrEqual(s.margins[1].margin);
  });

  it('rechaza un rango de fechas al revés', async () => {
    const r = await as('Dueño').get('/reports/summary?from=2026-11-10&to=2026-11-01');
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('from');
  });
});
