/* Inventario (RF-47 a RF-51): ajustes manuales, historial, aviso de stock bajo y sugerencia de surtido. */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
let events: { e: string; p: unknown; roles?: string[] }[];
let keySeq = 0;

const pid = (name: string) => (db.prepare('SELECT id FROM products WHERE name = ?').get(name) as { id: number }).id;
const stock = (name: string) => (db.prepare('SELECT stock FROM products WHERE name = ?').get(name) as { stock: number }).stock;
const moves = (name: string) => (db.prepare('SELECT COUNT(*) AS n FROM stock_movements WHERE product_id = ?').get(pid(name)) as { n: number }).n;

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object = {}, idem?: string) => {
    const r = request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`);
    return (idem ? r.set('Idempotency-Key', idem) : r).send(body);
  },
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});
const adjust = (body: object, who = 'Dueño') => as(who).post('/inventory/adjustments', body);

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  events = [];
  app = createApp(db, (e, p, roles) => events.push({ e, p, roles }));
  for (const u of db.prepare('SELECT id, name FROM users').all() as { id: number; name: string }[]) {
    tokens[u.name] = (await request(app).post('/auth/login').send({ userId: u.id, pin: DEMO_PIN })).body.token;
  }
});

/** Vende `qty` de un producto en una mesa y la cobra (o la deja sin cobrar). */
const sell = async (table: number, name: string, qty: number, charge = true) => {
  const id = (await as('Ana').post('/accounts', { tableNumber: table })).body.id as number;
  await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid(name), qty }] }, `inv-${++keySeq}-xxxxxxxx`);
  if (charge) {
    await as('Ana').post(`/accounts/${id}/request-bill`);
    await as('Cajero').post(`/accounts/${id}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' });
  }
  return id;
};

describe('ajustes manuales (RF-48)', () => {
  it('solo el dueño ajusta (RN-09)', async () => {
    for (const who of ['Ana', 'Cajero', 'Operador', 'Preparador']) {
      expect((await adjust({ productId: pid('Tinto'), type: 'entrada', qty: 5, reason: 'Compra suelta' }, who)).status).toBe(403);
    }
    expect((await as('Cajero').get('/inventory/suggestions')).status).toBe(403);
    expect(stock('Tinto')).toBe(120);
  });

  it('entrada suma y salida resta, con movimiento, usuario y auditoría (RN-02)', async () => {
    const r = await adjust({ productId: pid('Tinto'), type: 'entrada', qty: 10, reason: '  Llegó café  ' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ type: 'entrada', qty: 10, reason: 'Llegó café', reference: 'manual', user: 'Dueño' });
    expect(stock('Tinto')).toBe(130);
    const s = await adjust({ productId: pid('Tinto'), type: 'salida', qty: 4, reason: 'Se dañó' });
    expect(s.body.qty).toBe(-4);
    expect(stock('Tinto')).toBe(126);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'inventario'").get()).toEqual({ n: 2 });
  });

  it('el ajuste es un conteo físico: fija el stock y registra la diferencia', async () => {
    const r = await adjust({ productId: pid('Tinto'), type: 'ajuste', qty: 100, reason: 'Conteo del domingo' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ type: 'ajuste', qty: -20 });
    expect(stock('Tinto')).toBe(100);
    expect((await adjust({ productId: pid('Mojito'), type: 'ajuste', qty: 7, reason: 'Conteo' })).body.qty).toBe(7);
    expect(stock('Mojito')).toBe(7);
    // Conteo igual al sistema: nada que registrar.
    const same = await adjust({ productId: pid('Tinto'), type: 'ajuste', qty: 100, reason: 'Conteo' });
    expect(same.status).toBe(409);
    expect(same.body.field).toBe('qty');
  });

  it('nunca deja stock negativo y no deja nada a medias', async () => {
    const before = moves('Ron botella');
    const r = await adjust({ productId: pid('Ron botella'), type: 'salida', qty: 2, reason: 'Se rompió' });
    expect(r.status).toBe(409);
    expect(r.body.field).toBe('qty');
    expect(stock('Ron botella')).toBe(1);
    expect(moves('Ron botella')).toBe(before);
  });

  it.each([
    [{ type: 'entrada', qty: 0, reason: 'Compra' }, 'qty'],
    [{ type: 'entrada', qty: 2.5, reason: 'Compra' }, 'qty'],
    [{ type: 'ajuste', qty: -1, reason: 'Conteo' }, 'qty'],
    [{ type: 'regalo', qty: 1, reason: 'Compra' }, 'type'],
    [{ type: 'entrada', qty: 1, reason: '  ' }, 'reason'],
    [{ type: 'entrada', qty: 1 }, 'reason'],
  ])('rechaza %o con el campo que falló', async (body, field) => {
    const r = await adjust({ productId: pid('Tinto'), ...body });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
    expect(stock('Tinto')).toBe(120);
  });

  it('producto inexistente → 404', async () => {
    expect((await adjust({ productId: 9999, type: 'entrada', qty: 1, reason: 'Compra' })).status).toBe(404);
  });
});

describe('historial (RF-49)', () => {
  it('filtra por tipo y muestra referencia y usuario', async () => {
    await adjust({ productId: pid('Tinto'), type: 'salida', qty: 1, reason: 'Probado' });
    const all = (await as('Dueño').get(`/products/${pid('Tinto')}/movements`)).body;
    expect(all).toHaveLength(2);
    const out = (await as('Dueño').get(`/products/${pid('Tinto')}/movements?type=salida`)).body;
    expect(out).toEqual([expect.objectContaining({ type: 'salida', qty: -1, reference: 'manual', user: 'Dueño', createdAt: expect.any(String) })]);
  });
});

describe('aviso de stock bajo (RF-50)', () => {
  const low = () => events.filter((x) => x.e === 'stock:bajo');

  it('se emite solo al dueño tras un ajuste que cruza el mínimo, una vez', async () => {
    await adjust({ productId: pid('Tinto'), type: 'salida', qty: 99, reason: 'Revisión' }); // 120 → 21, sigue sobre 20
    expect(low()).toHaveLength(0);
    await adjust({ productId: pid('Tinto'), type: 'ajuste', qty: 20, reason: 'Conteo' }); // 21 → 20: cruza
    expect(low()).toEqual([{ e: 'stock:bajo', p: { productId: pid('Tinto'), name: 'Tinto', stock: 20, minStock: 20 }, roles: [] }]);
    await adjust({ productId: pid('Tinto'), type: 'salida', qty: 1, reason: 'Revisión' }); // ya estaba bajo
    expect(low()).toHaveLength(1);
  });

  it('se emite al editar un ítem que lleva el stock bajo el mínimo', async () => {
    const id = (await as('Ana').post('/accounts', { tableNumber: 1 })).body.id as number;
    const acc = (await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Águila 330 ml'), qty: 30 }] }, 'inv-edit-xxxxxxxx')).body;
    expect(low()).toHaveLength(0); // 48 → 18, sobre 12
    const r = await as('Ana').patch(`/rounds/items/${acc.rounds[0].items[0].id}`, { qty: 40 });
    expect(r.status).toBe(200);
    expect(stock('Águila 330 ml')).toBe(8);
    expect(low()).toEqual([expect.objectContaining({ p: expect.objectContaining({ name: 'Águila 330 ml', stock: 8 }), roles: [] })]);
  });
});

describe('sugerencia de surtido (RF-51)', () => {
  it('incluye los de stock bajo y los más vendidos con factura válida', async () => {
    await sell(1, 'Club Colombia', 25); // 30 → 5 (mín. 10), vendido 25 → max(20, 25) − 5 = 20
    await sell(2, 'Tinto', 10); // 120, vendido 10: no hace falta surtir
    await sell(3, 'Michelada', 3, false); // sin cobrar: no cuenta como vendido
    const voided = await sell(4, 'Café de origen', 35); // 40 → 5 (mín. 10)
    const inv = (await as('Dueño').get(`/accounts/${voided}`)).body.invoiceId as number;
    await as('Dueño').post(`/invoices/${inv}/void`, { reason: 'Error de cobro' }); // devuelve al stock y no cuenta
    const r = await as('Dueño').get('/inventory/suggestions');
    expect(r.status).toBe(200);
    const by = Object.fromEntries((r.body as { name: string }[]).map((x) => [x.name, x]));
    expect(by['Club Colombia']).toMatchObject({ stock: 5, minStock: 10, sold7d: 25, suggested: 20, lowStock: true });
    expect(by['Aguardiente 1/2']).toMatchObject({ stock: 2, sold7d: 0, suggested: 8, lowStock: true });
    expect(by['Mojito']).toMatchObject({ stock: 0, suggested: 10 });
    expect(by.Tinto).toBeUndefined();
    expect(by.Michelada).toBeUndefined();
    expect(by['Café de origen']).toBeUndefined();
    // Los de stock bajo van primero.
    expect((r.body as { lowStock: boolean }[]).every((x, i, a) => i === 0 || a[i - 1].lowStock || !x.lowStock)).toBe(true);
  });

  it('un vendido muy rápido entra aunque no esté bajo el mínimo', async () => {
    await adjust({ productId: pid('Agua 600 ml'), type: 'entrada', qty: 100, reason: 'Compra grande' }); // 124, mín. 6
    await sell(1, 'Agua 600 ml', 110); // queda 14, vendido 110 → 110 − 14 = 96
    const s = (await as('Dueño').get('/inventory/suggestions')).body.find((x: { name: string }) => x.name === 'Agua 600 ml');
    expect(s).toMatchObject({ stock: 14, sold7d: 110, suggested: 96, lowStock: false });
  });

  it('una cuenta unida no se cuenta dos veces', async () => {
    const a = await sell(1, 'Club Colombia', 5, false);
    const b = await sell(2, 'Club Colombia', 20, false);
    await as('Dueño').post(`/accounts/${a}/merge`, { intoAccountId: b });
    await as('Ana').post(`/accounts/${b}/request-bill`);
    await as('Cajero').post(`/accounts/${b}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' });
    const s = (await as('Dueño').get('/inventory/suggestions')).body.find((x: { name: string }) => x.name === 'Club Colombia');
    expect(s).toMatchObject({ sold7d: 25, stock: 5 });
  });
});
