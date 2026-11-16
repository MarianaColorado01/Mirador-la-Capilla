/* Proveedores (RF-52) y compras (RF-53 a RF-55). */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDate } from '@mirador/shared';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};

const pid = (name: string) => (db.prepare('SELECT id FROM products WHERE name = ?').get(name) as { id: number }).id;
const product = (name: string) => db.prepare('SELECT stock, cost FROM products WHERE name = ?').get(name) as { stock: number; cost: number };
const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const supplierX = () => (db.prepare("SELECT id FROM suppliers WHERE name = 'Distribuidora X'").get() as { id: number }).id;

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object = {}, idem?: string) => {
    const r = request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`);
    return (idem ? r.set('Idempotency-Key', idem) : r).send(body);
  },
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});
const buy = (body: object, who = 'Dueño') => as(who).post('/purchases', { supplierId: supplierX(), date: localDate(), ...body });

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  for (const u of db.prepare('SELECT id, name FROM users').all() as { id: number; name: string }[]) {
    tokens[u.name] = (await request(app).post('/auth/login').send({ userId: u.id, pin: DEMO_PIN })).body.token;
  }
});

describe('proveedores (RF-52)', () => {
  it('solo el dueño los ve y los cambia (RN-09)', async () => {
    for (const who of ['Ana', 'Cajero', 'Operador', 'Preparador']) {
      expect((await as(who).get('/suppliers')).status).toBe(403);
      expect((await as(who).post('/suppliers', { name: 'Otro' })).status).toBe(403);
      expect((await as(who).get('/purchases')).status).toBe(403);
    }
  });

  it('crea con datos opcionales vacíos y edita con coordenadas', async () => {
    const c = await as('Dueño').post('/suppliers', { name: '  Hielos La Sierra ', phone: '', notes: '', address: null });
    expect(c.status).toBe(201);
    expect(c.body).toEqual({ id: expect.any(Number), name: 'Hielos La Sierra', phone: null, notes: null, address: null, lat: null, lng: null, active: true });
    const e = await as('Dueño').patch(`/suppliers/${c.body.id}`, { phone: '+57 310 555 0000', address: 'Vereda La Capilla', lat: 4.99, lng: -75.81 });
    expect(e.body).toMatchObject({ phone: '+57 310 555 0000', address: 'Vereda La Capilla', lat: 4.99, lng: -75.81 });
    const clear = await as('Dueño').patch(`/suppliers/${c.body.id}`, { lat: null, lng: null });
    expect(clear.body).toMatchObject({ lat: null, lng: null });
    expect((await as('Dueño').get(`/suppliers/${c.body.id}`)).body.name).toBe('Hielos La Sierra');
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'proveedor'").get()).toEqual({ n: 3 });
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ name: 'X', phone: 'llamar' }, 'phone'],
    [{ name: 'X', lat: 91, lng: 0 }, 'lat'],
    [{ name: 'X', lat: 0, lng: -181 }, 'lng'],
    [{ name: 'X', lat: 4.9 }, 'lng'],
    [{ name: 'X', lng: -75 }, 'lat'],
  ])('rechaza %o con el campo que falló', async (body, field) => {
    const r = await as('Dueño').post('/suppliers', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('desactivar no borra (RN-04) y un id inexistente da 404', async () => {
    const r = await as('Dueño').patch(`/suppliers/${supplierX()}`, { active: false });
    expect(r.body.active).toBe(false);
    expect((await as('Dueño').get('/suppliers')).body).toHaveLength(1);
    expect((await as('Dueño').get('/suppliers/9999')).status).toBe(404);
    expect((await as('Dueño').patch('/suppliers/9999', { name: 'Nadie' })).status).toBe(404);
  });
});

describe('registrar compra (RF-53, RF-54)', () => {
  it('sube el stock, crea entradas con referencia y actualiza el último costo', async () => {
    const r = await buy({ items: [{ productId: pid('Tinto'), qty: 30, unitCost: 700 }, { productId: pid('Ron botella'), qty: 2, unitCost: 40000 }], total: 1 });
    expect(r.status).toBe(201);
    // El total del cliente se ignora: 30 × 700 + 2 × 40000.
    expect(r.body).toMatchObject({ supplierName: 'Distribuidora X', date: localDate(), total: 101000, itemCount: 2, user: 'Dueño' });
    expect(r.body.items).toEqual([
      expect.objectContaining({ name: 'Tinto', qty: 30, unitCost: 700, total: 21000 }),
      expect.objectContaining({ name: 'Ron botella', qty: 2, unitCost: 40000, total: 80000 }),
    ]);
    expect(product('Tinto')).toEqual({ stock: 150, cost: 700 });
    expect(product('Ron botella')).toEqual({ stock: 3, cost: 40000 });
    const m = db.prepare("SELECT type, qty, reference, user_id FROM stock_movements WHERE reference = ?").all(`compra:${r.body.id}`);
    expect(m).toEqual([
      { type: 'entrada', qty: 30, reference: `compra:${r.body.id}`, user_id: expect.any(Number) },
      { type: 'entrada', qty: 2, reference: `compra:${r.body.id}`, user_id: expect.any(Number) },
    ]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'compra'").get()).toEqual({ n: 1 });
    // Aparece en el historial del producto (RF-49).
    const moves = (await as('Dueño').get(`/products/${pid('Tinto')}/movements`)).body;
    expect(moves[0]).toMatchObject({ type: 'entrada', qty: 30, reference: `compra:${r.body.id}`, user: 'Dueño' });
  });

  it('el costo nuevo no toca los ítems de ronda ya registrados (RN-03)', async () => {
    const acc = (await as('Ana').post('/accounts', { tableNumber: 1 })).body.id as number;
    await as('Ana').post(`/accounts/${acc}/rounds`, { items: [{ productId: pid('Tinto'), qty: 2 }] }, 'compra-rn03-xxxxxxxx');
    await buy({ items: [{ productId: pid('Tinto'), qty: 10, unitCost: 900 }] });
    expect(product('Tinto').cost).toBe(900);
    expect(db.prepare('SELECT unit_cost FROM round_items WHERE product_id = ?').all(pid('Tinto'))).toEqual([{ unit_cost: 600 }]);
  });

  it.each([
    [{ date: '2999-01-01' }, 'date'],
    [{ date: '2026-02-30' }, 'date'],
    [{ date: '16/11/2026' }, 'date'],
    [{ items: [] }, 'items'],
    [{ items: [{ productId: 1, qty: 1.5, unitCost: 700 }] }, 'items.0.qty'],
    [{ items: [{ productId: 1, qty: 0, unitCost: 700 }] }, 'items.0.qty'],
    [{ items: [{ productId: 1, qty: 3, unitCost: 0 }] }, 'items.0.unitCost'],
  ])('rechaza %o con el campo que falló', async (body, field) => {
    const r = await buy({ items: [{ productId: pid('Tinto'), qty: 1, unitCost: 700 }], ...body });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
    expect(count('purchases')).toBe(0);
    expect(product('Tinto').stock).toBe(120);
  });

  it('rechaza un proveedor inactivo o inexistente', async () => {
    await as('Dueño').patch(`/suppliers/${supplierX()}`, { active: false });
    const r = await buy({ items: [{ productId: pid('Tinto'), qty: 1, unitCost: 700 }] });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('supplierId');
    expect((await buy({ supplierId: 9999, items: [{ productId: pid('Tinto'), qty: 1, unitCost: 700 }] })).body.field).toBe('supplierId');
  });

  it('un producto inactivo en el segundo ítem no deja nada a medias', async () => {
    await as('Dueño').patch(`/products/${pid('Mojito')}`, { active: false });
    const moves = count('stock_movements');
    const r = await buy({ items: [{ productId: pid('Tinto'), qty: 5, unitCost: 700 }, { productId: pid('Mojito'), qty: 5, unitCost: 3000 }] });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ field: 'items.1.productId', error: expect.stringContaining('Mojito') });
    expect(product('Tinto')).toEqual({ stock: 120, cost: 600 });
    expect(count('purchases')).toBe(0);
    expect(count('purchase_items')).toBe(0);
    expect(count('stock_movements')).toBe(moves);
    expect((await buy({ items: [{ productId: 9999, qty: 1, unitCost: 700 }] })).body.field).toBe('items.0.productId');
  });
});

describe('historial de compras (RF-55)', () => {
  it('filtra por proveedor y rango de fechas, y muestra el detalle', async () => {
    const other = (await as('Dueño').post('/suppliers', { name: 'Licores del Eje' })).body.id as number;
    const a = (await buy({ date: '2026-10-01', items: [{ productId: pid('Tinto'), qty: 1, unitCost: 700 }] })).body.id;
    const b = (await buy({ supplierId: other, date: '2026-10-15', items: [{ productId: pid('Ron botella'), qty: 1, unitCost: 38000 }] })).body.id;
    const c = (await buy({ date: '2026-11-01', items: [{ productId: pid('Tinto'), qty: 2, unitCost: 700 }] })).body.id;
    const ids = async (q: string) => ((await as('Dueño').get(`/purchases${q}`)).body as { id: number }[]).map((x) => x.id);
    expect(await ids('')).toEqual([c, b, a]);
    expect(await ids(`?supplierId=${supplierX()}`)).toEqual([c, a]);
    expect(await ids('?from=2026-10-01&to=2026-10-15')).toEqual([b, a]);
    expect(await ids(`?supplierId=${other}&from=2026-10-16`)).toEqual([]);
    expect((await as('Dueño').get('/purchases?from=ayer')).body.field).toBe('from');
    expect((await as('Dueño').get('/purchases?from=2026-11-01&to=2026-10-01')).body.field).toBe('to');
    const d = (await as('Dueño').get(`/purchases/${c}`)).body;
    expect(d).toMatchObject({ id: c, supplierName: 'Distribuidora X', total: 1400, user: 'Dueño', items: [expect.objectContaining({ name: 'Tinto', qty: 2, unitCost: 700, total: 1400 })] });
  });

  it('compra inexistente → 404', async () => {
    expect((await as('Dueño').get('/purchases/9999')).status).toBe(404);
    expect((await as('Dueño').get('/purchases/abc')).status).toBe(404);
  });
});
