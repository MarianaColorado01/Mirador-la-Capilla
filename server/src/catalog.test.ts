/* Productos (RF-12 a RF-14), categorías (RF-15) y mesas (RF-22): solo el dueño, validaciones por campo y RN-04. */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
const uid = (name: string) => (db.prepare('SELECT id FROM users WHERE name = ?').get(name) as { id: number }).id;
const one = <T>(sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as T;

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object, headers: Record<string, string> = {}) =>
    request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`).set(headers).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

const cafe = () => one<{ id: number }>("SELECT id FROM categories WHERE name = 'Café'").id;
const tinto = () => one<{ id: number }>("SELECT id FROM products WHERE name = 'Tinto'").id;
const valid = () => ({ name: 'Capuchino', categoryId: cafe(), price: 7000, cost: 2000, minStock: 5, imageUrl: '' });

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  for (const name of ['Ana', 'Cajero', 'Dueño']) {
    tokens[name] = (await request(app).post('/auth/login').send({ userId: uid(name), pin: DEMO_PIN })).body.token;
  }
});

describe('detalle de producto (RF-12)', () => {
  it('el mesero ve precio y stock, sin costo ni margen', async () => {
    const r = await as('Ana').get(`/products/${tinto()}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'Tinto', price: 2500, stock: 120, minStock: 20 });
    expect(r.body.cost).toBeUndefined();
  });

  it('el dueño ve costo y margen', async () => {
    expect((await as('Dueño').get(`/products/${tinto()}`)).body).toMatchObject({ cost: 600, margin: 1900 });
  });

  it.each(['9999', 'abc'])('id %s → 404 «Producto no encontrado»', async (id) => {
    const r = await as('Ana').get(`/products/${id}`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Producto no encontrado');
  });

  it('movimientos: solo el dueño, con tipo, cantidad, referencia, fecha y usuario', async () => {
    expect((await as('Ana').get(`/products/${tinto()}/movements`)).status).toBe(403);
    const r = await as('Dueño').get(`/products/${tinto()}/movements`);
    expect(r.status).toBe(200);
    expect(r.body[0]).toMatchObject({ type: 'entrada', qty: 120, reference: 'semilla', user: 'Dueño', createdAt: expect.stringMatching(/Z$/) });
    expect((await as('Dueño').get('/products/9999/movements')).status).toBe(404);
  });
});

describe('crear y editar productos (RF-13, RF-14)', () => {
  it('solo el dueño crea; el stock arranca en 0 y la imagen vacía queda sin imagen', async () => {
    expect((await as('Cajero').post('/products', valid())).status).toBe(403);
    const r = await as('Dueño').post('/products', valid());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: 'Capuchino', stock: 0, imageUrl: null, margin: 5000, active: true });
    expect(one('SELECT COUNT(*) AS n FROM stock_movements WHERE product_id = ?', r.body.id)).toEqual({ n: 0 });
    expect(one("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'producto'")).toEqual({ n: 1 });
  });

  it.each([
    [{ name: '  ' }, 'name'],
    [{ categoryId: 0 }, 'categoryId'],
    [{ price: 0 }, 'price'],
    [{ cost: -5 }, 'cost'],
    [{ price: '5000' }, 'price'],
    [{ minStock: -1 }, 'minStock'],
    [{ minStock: 1.5 }, 'minStock'],
    [{ imageUrl: 'foto.png' }, 'imageUrl'],
  ])('rechaza %o con el campo que falló', async (patch, field) => {
    const r = await as('Dueño').post('/products', { ...valid(), ...patch });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
    expect(one("SELECT COUNT(*) AS n FROM products WHERE name = 'Capuchino'")).toEqual({ n: 0 });
  });

  it('rechaza una categoría inexistente o inactiva', async () => {
    const r = await as('Dueño').post('/products', { ...valid(), categoryId: 999 });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('categoryId');
  });

  it('editar no toca el stock (RN-02) y 404 si no existe', async () => {
    const r = await as('Dueño').patch(`/products/${tinto()}`, { price: 3000, stock: 999 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ price: 3000, stock: 120, margin: 2400 });
    expect((await as('Dueño').patch('/products/9999', { price: 3000 })).status).toBe(404);
    expect((await as('Ana').patch(`/products/${tinto()}`, { price: 1 })).status).toBe(403);
  });

  it('desactivado: no sale al tomar pedidos ni se puede pedir, pero el dueño lo ve con ?all=1', async () => {
    const id = tinto();
    await as('Dueño').patch(`/products/${id}`, { active: false });
    expect((await as('Ana').get('/products')).body.some((p: { id: number }) => p.id === id)).toBe(false);
    expect((await as('Ana').get('/products?all=1')).body.some((p: { id: number }) => p.id === id)).toBe(false);
    expect((await as('Dueño').get('/products?all=1')).body.find((p: { id: number }) => p.id === id)).toMatchObject({ active: false });

    const acc = await as('Ana').post('/accounts', { tableNumber: 1 });
    const r = await as('Ana').post(`/accounts/${acc.body.id}/rounds`, { items: [{ productId: id, qty: 1 }] }, { 'Idempotency-Key': 'k-inactivo' });
    expect(r.status).toBe(409);
    expect(one('SELECT stock FROM products WHERE id = ?', id)).toEqual({ stock: 120 });
  });
});

describe('categorías (RF-15)', () => {
  it('solo el dueño; crea, renombra y el nombre es único sin importar mayúsculas', async () => {
    expect((await as('Ana').get('/categories')).status).toBe(403);
    const r = await as('Dueño').post('/categories', { name: 'Postres' });
    expect(r.status).toBe(201);
    const dup = await as('Dueño').post('/categories', { name: 'cervezas' });
    expect(dup.status).toBe(409);
    expect(dup.body.field).toBe('name');
    expect((await as('Dueño').patch(`/categories/${r.body.id}`, { name: 'Café' })).status).toBe(409);
    expect((await as('Dueño').patch(`/categories/${r.body.id}`, { name: 'Dulces' })).body).toMatchObject({ name: 'Dulces' });
    expect((await as('Dueño').post('/categories', { name: ' ' })).body.field).toBe('name');
  });

  it('no desactiva una categoría con productos activos; vacía sí', async () => {
    const r = await as('Dueño').patch(`/categories/${cafe()}`, { active: false });
    expect(r.status).toBe(409);
    expect(r.body.field).toBe('active');
    const empty = await as('Dueño').post('/categories', { name: 'Postres' });
    expect((await as('Dueño').patch(`/categories/${empty.body.id}`, { active: false })).body).toMatchObject({ active: false });
    // Una categoría inactiva no recibe productos nuevos.
    expect((await as('Dueño').post('/products', { ...valid(), categoryId: empty.body.id })).body.field).toBe('categoryId');
  });
});

describe('mesas (RF-22)', () => {
  it('solo el dueño; crea con número único y zona opcional', async () => {
    expect((await as('Cajero').post('/tables', { number: 9 })).status).toBe(403);
    const r = await as('Dueño').post('/tables', { number: 9, zone: '' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ number: 9, zone: null, active: true, busy: false });
    const dup = await as('Dueño').post('/tables', { number: 3 });
    expect(dup.status).toBe(409);
    expect(dup.body.field).toBe('number');
    expect((await as('Dueño').post('/tables', { number: 0 })).body.field).toBe('number');
    expect((await as('Dueño').get('/tables/all')).body).toHaveLength(9);
  });

  it('no desactiva una mesa con cuenta abierta; libre sí, y deja de salir en el mapa', async () => {
    await as('Ana').post('/accounts', { tableNumber: 1 });
    const id1 = one<{ id: number }>('SELECT id FROM tables WHERE number = 1').id;
    const busy = await as('Dueño').patch(`/tables/${id1}`, { active: false });
    expect(busy.status).toBe(409);
    expect(busy.body.field).toBe('active');
    expect(one('SELECT active FROM tables WHERE id = ?', id1)).toEqual({ active: 1 });

    const id2 = one<{ id: number }>('SELECT id FROM tables WHERE number = 2').id;
    expect((await as('Dueño').patch(`/tables/${id2}`, { active: false })).body).toMatchObject({ active: false });
    expect((await as('Ana').get('/tables')).body.some((t: { number: number }) => t.number === 2)).toBe(false);
    expect((await as('Ana').post('/accounts', { tableNumber: 2 })).status).not.toBe(201);
    // Reactivar con su número existente: el número sigue reservado.
    expect((await as('Dueño').post('/tables', { number: 2 })).body.error).toMatch(/inactiva/);
  });
});
