/* Proceso principal: abrir mesa → rondas → barra → pedir cuenta → cobrar. Reglas RN-01 a RN-09. */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, saveSettings, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
let events: string[];

const pid = (name: string) => (db.prepare('SELECT id FROM products WHERE name = ?').get(name) as { id: number }).id;
const stock = (name: string) => (db.prepare('SELECT stock FROM products WHERE name = ?').get(name) as { stock: number }).stock;
let keySeq = 0;
const key = () => `prueba-${++keySeq}-xxxxxxxx`;

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object = {}, idem?: string) => {
    const r = request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`);
    return (idem ? r.set('Idempotency-Key', idem) : r).send(body);
  },
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  events = [];
  app = createApp(db, (e) => events.push(e));
  for (const u of db.prepare('SELECT id, name FROM users').all() as { id: number; name: string }[]) {
    tokens[u.name] = (await request(app).post('/auth/login').send({ userId: u.id, pin: DEMO_PIN })).body.token;
  }
});

const openTable = async (n = 1, who = 'Ana') => (await as(who).post('/accounts', { tableNumber: n })).body.id as number;

describe('mesas y cuentas', () => {
  it('abre una mesa libre y la marca ocupada (RF-16, RF-17)', async () => {
    const r = await as('Ana').post('/accounts', { tableNumber: 2 });
    expect(r.status).toBe(201);
    const t = (await as('Ana').get('/tables')).body.find((x: { number: number }) => x.number === 2);
    expect(t.status).toBe('ocupada');
    expect(events).toContain('mesa:actualizada');
  });

  it('no crea una segunda cuenta en la misma mesa (RN-01)', async () => {
    const first = await openTable(3, 'Ana');
    const r = await as('Luis').post('/accounts', { tableNumber: 3 });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Ana ya abrió la mesa 3/);
    expect(r.body.accountId).toBe(first);
  });

  it('barra no puede abrir mesas (RN-09)', async () => {
    expect((await as('Preparador').post('/accounts', { tableNumber: 4 })).status).toBe(403);
  });

  it('cuenta inexistente → «Cuenta no encontrada» (RF-18)', async () => {
    const r = await as('Ana').get('/accounts/999');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Cuenta no encontrada');
  });
});

describe('rondas', () => {
  it('descuenta stock, congela precios y crea la ronda en «tomado» (RF-27, RN-02, RN-03)', async () => {
    const id = await openTable();
    const r = await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Águila 330 ml'), qty: 2, note: 'bien fría' }] }, key());
    expect(r.status).toBe(201);
    expect(r.body.rounds[0].status).toBe('tomado');
    expect(r.body.rounds[0].items[0]).toMatchObject({ qty: 2, unitPrice: 4000, note: 'bien fría' });
    expect(r.body.subtotal).toBe(8000);
    expect(stock('Águila 330 ml')).toBe(46);
    db.prepare("UPDATE products SET price = 9999 WHERE name = 'Águila 330 ml'").run();
    expect((await as('Ana').get(`/accounts/${id}`)).body.subtotal).toBe(8000);
  });

  it('el doble toque con la misma clave no duplica la ronda (RF-27)', async () => {
    const id = await openTable();
    const k = key();
    const body = { items: [{ productId: pid('Club Colombia'), qty: 1 }] };
    expect((await as('Ana').post(`/accounts/${id}/rounds`, body, k)).status).toBe(201);
    const again = await as('Ana').post(`/accounts/${id}/rounds`, body, k);
    expect(again.status).toBe(200);
    expect(again.body.rounds).toHaveLength(1);
    expect(stock('Club Colombia')).toBe(29);
  });

  it('la misma clave con otros productos se rechaza y no pierde lo nuevo (RF-27)', async () => {
    const id = await openTable();
    const k = key();
    await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Club Colombia'), qty: 1 }] }, k);
    const edited = await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Club Colombia'), qty: 3 }] }, k);
    expect(edited.status).toBe(422);
    expect(edited.body.field).toBe('Idempotency-Key');
    expect((await as('Ana').get(`/accounts/${id}`)).body.rounds).toHaveLength(1);
    expect(stock('Club Colombia')).toBe(29);
  });

  it('rechaza la ronda si algún ítem supera el stock y no toca nada (RN-08)', async () => {
    const id = await openTable();
    const r = await as('Ana').post(`/accounts/${id}/rounds`, {
      items: [{ productId: pid('Águila 330 ml'), qty: 1 }, { productId: pid('Aguardiente 1/2'), qty: 3 }],
    }, key());
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/solo quedan 2/);
    expect(stock('Águila 330 ml')).toBe(48);
    expect((await as('Ana').get(`/accounts/${id}`)).body.rounds).toHaveLength(0);
  });

  it('valida nota de hasta 100 caracteres y cantidades enteras (RF-24, RF-25)', async () => {
    const id = await openTable();
    const long = await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: 1, qty: 1, note: 'x'.repeat(101) }] }, key());
    expect(long.status).toBe(400);
    const zero = await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: 1, qty: 0 }] }, key());
    expect(zero.status).toBe(400);
  });

  it('en modo un solo operador la ronda queda entregada (RF-29)', async () => {
    const id = await openTable(5, 'Operador');
    const r = await as('Operador').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Tinto'), qty: 1 }] }, key());
    expect(r.body.rounds[0].status).toBe('entregado');
    saveSettings(db, { singleOperator: false });
    const r2 = await as('Operador').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Tinto'), qty: 1 }] }, key());
    expect(r2.body.rounds[1].status).toBe('tomado');
  });

  it('avisa cuando un producto baja del mínimo (RF-50)', async () => {
    const id = await openTable();
    await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Águila 330 ml'), qty: 36 }] }, key());
    expect(events).toContain('stock:bajo');
  });
});

describe('barra y estados (RF-30, RF-31)', () => {
  const setup = async () => {
    const id = await openTable();
    const acc = (await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Michelada'), qty: 1 }] }, key())).body;
    return { id, roundId: acc.rounds[0].id as number };
  };

  it('barra ve la ronda y la avanza un paso a la vez', async () => {
    const { roundId } = await setup();
    const queue = (await as('Preparador').get('/rounds')).body;
    expect(queue[0]).toMatchObject({ roundId, tableNumber: 1, takenBy: 'Ana', status: 'tomado' });
    expect((await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'listo' })).status).toBe(409);
    expect((await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'preparacion' })).status).toBe(200);
    expect((await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'listo' })).status).toBe(200);
    expect(events).toContain('ronda:estado');
  });

  it('el mesero no prepara; barra no entrega', async () => {
    const { roundId } = await setup();
    expect((await as('Ana').patch(`/rounds/${roundId}/status`, { status: 'preparacion' })).status).toBe(403);
    await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'preparacion' });
    await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'listo' });
    expect((await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'entregado' })).status).toBe(403);
    expect((await as('Ana').patch(`/rounds/${roundId}/status`, { status: 'entregado' })).status).toBe(200);
  });
});

describe('anulaciones (tabla 4.2)', () => {
  const setup = async () => {
    const id = await openTable();
    const acc = (await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Club Colombia'), qty: 2 }] }, key())).body;
    return { id, roundId: acc.rounds[0].id as number, itemId: acc.rounds[0].items[0].id as number };
  };

  it('en «tomado» el mesero quita el ítem y el stock vuelve (RF-33)', async () => {
    const { itemId } = await setup();
    const r = await as('Ana').post(`/rounds/items/${itemId}/void`, { reason: 'Se equivocó de mesa', restock: false });
    expect(r.status).toBe(200);
    expect(r.body.subtotal).toBe(0);
    expect(r.body.rounds[0].items[0].voided).toMatchObject({ by: 'Ana', reason: 'Se equivocó de mesa', restocked: true });
    expect(stock('Club Colombia')).toBe(30);
  });

  it('en preparación solo caja o dueño, y deciden si vuelve el stock (RF-34)', async () => {
    const { roundId, itemId } = await setup();
    await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'preparacion' });
    expect((await as('Ana').post(`/rounds/items/${itemId}/void`, { reason: 'Cliente no quiso' })).status).toBe(403);
    expect((await as('Cajero').post(`/rounds/items/${itemId}/void`, { reason: 'Cliente no quiso', restock: false })).status).toBe(200);
    expect(stock('Club Colombia')).toBe(28);
  });

  it('entregada: solo el dueño, sin devolver stock (RF-35)', async () => {
    const { roundId, itemId } = await setup();
    for (const [who, s] of [['Preparador', 'preparacion'], ['Preparador', 'listo'], ['Ana', 'entregado']] as const)
      await as(who).patch(`/rounds/${roundId}/status`, { status: s });
    expect((await as('Cajero').post(`/rounds/items/${itemId}/void`, { reason: 'Se derramó' })).status).toBe(403);
    const r = await as('Dueño').post(`/rounds/items/${itemId}/void`, { reason: 'Se derramó', restock: true });
    expect(r.body.rounds[0].items[0].voided.restocked).toBe(false);
    expect(stock('Club Colombia')).toBe(28);
  });

  it('exige motivo y queda en la auditoría (RF-37)', async () => {
    const { itemId } = await setup();
    expect((await as('Ana').post(`/rounds/items/${itemId}/void`, { reason: '' })).status).toBe(400);
    await as('Ana').post(`/rounds/items/${itemId}/void`, { reason: 'Error al tomar' });
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'anular'").get() as { n: number };
    expect(n).toBe(1);
  });
});

describe('cobro y factura', () => {
  const billable = async (table = 1) => {
    const id = await openTable(table);
    await as('Ana').post(`/accounts/${id}/rounds`, {
      items: [{ productId: pid('Águila 330 ml'), qty: 2 }, { productId: pid('Aguardiente 1/2'), qty: 1 }, { productId: pid('Club Colombia'), qty: 2 }],
    }, key());
    await as('Ana').post(`/accounts/${id}/request-bill`);
    return id;
  };

  it('pedir la cuenta bloquea nuevas rondas hasta que caja la reabra (RF-19, RF-21, RN-07)', async () => {
    const id = await billable();
    expect((await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: 1, qty: 1 }] }, key())).status).toBe(409);
    expect((await as('Ana').post(`/accounts/${id}/reopen`)).status).toBe(403);
    expect((await as('Cajero').post(`/accounts/${id}/reopen`)).status).toBe(200);
    expect((await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: 1, qty: 1 }] }, key())).status).toBe(201);
  });

  it('caja lista las cuentas por cobrar (RF-38)', async () => {
    await billable();
    const r = await as('Cajero').get('/accounts?status=por_cobrar');
    expect(r.body).toEqual([expect.objectContaining({ tableNumber: 1, waiter: 'Ana', subtotal: 63000 })]);
  });

  it('valida descuento, propina y efectivo con mensaje por campo (RF-40, RF-41)', async () => {
    const id = await billable();
    const neg = await as('Cajero').post(`/accounts/${id}/charge`, { discount: '-1', tipPercent: '10', method: 'efectivo', received: '100000' });
    expect(neg.status).toBe(400);
    expect(neg.body.field).toBe('discount');
    const poor = await as('Cajero').post(`/accounts/${id}/charge`, { discount: '0', tipPercent: '10', method: 'efectivo', received: '1000' });
    expect(poor.body.field).toBe('received');
  });

  it('factura con el total de la sección 4.3, número consecutivo y mesa libre (RF-39, RF-42, RN-06)', async () => {
    const id = await billable(1);
    const r = await as('Cajero').post(`/accounts/${id}/charge`, { discount: '3.000', tipPercent: '10', method: 'efectivo', received: '80.000' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ number: 1, subtotal: 63000, discount: 3000, tip: 6000, tax: 4800, total: 70800, received: 80000, change: 9200, tableNumber: 1 });
    const t = (await as('Ana').get('/tables')).body.find((x: { number: number }) => x.number === 1);
    expect(t.status).toBe('libre');

    const id2 = await billable(2);
    const r2 = await as('Cajero').post(`/accounts/${id2}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' });
    expect(r2.body.number).toBe(2);
    expect((await as('Cajero').post(`/accounts/${id}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' })).status).toBe(409);
  });

  it('historial y detalle de facturas (RF-43)', async () => {
    const id = await billable();
    const inv = (await as('Cajero').post(`/accounts/${id}/charge`, { discount: '', tipPercent: '', method: 'transferencia' })).body;
    const list = (await as('Cajero').get(`/invoices?q=${inv.number}`)).body;
    expect(list).toHaveLength(1);
    expect((await as('Cajero').get(`/invoices/${inv.id}`)).body.items).toHaveLength(3);
    expect((await as('Cajero').get('/invoices/999')).body.error).toBe('Factura no encontrada');
  });
});

describe('mover y unir cuentas (RF-20)', () => {
  const withRound = async (table: number) => {
    const id = await openTable(table);
    await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Tinto'), qty: 1 }] }, key());
    return id;
  };
  const tableStatus = async (n: number) => (await as('Ana').get('/tables')).body.find((x: { number: number }) => x.number === n).status;

  it('caja mueve la cuenta a una mesa libre; la origen queda libre', async () => {
    const id = await withRound(1);
    expect((await as('Ana').post(`/accounts/${id}/move`, { tableNumber: 2 })).status).toBe(403);
    events = [];
    const r = await as('Cajero').post(`/accounts/${id}/move`, { tableNumber: 2 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id, tableNumber: 2, subtotal: 2500 });
    expect(await tableStatus(1)).toBe('libre');
    expect(await tableStatus(2)).toBe('ocupada');
    expect(events).toEqual(['mesa:actualizada', 'mesa:actualizada']);
  });

  it('no mueve a una mesa ocupada ni inexistente (RN-01)', async () => {
    const id = await withRound(1);
    await openTable(2, 'Luis');
    const busy = await as('Cajero').post(`/accounts/${id}/move`, { tableNumber: 2 });
    expect(busy.status).toBe(409);
    expect(busy.body.field).toBe('tableNumber');
    expect((await as('Cajero').post(`/accounts/${id}/move`, { tableNumber: 99 })).status).toBe(404);
    expect((await as('Ana').get(`/accounts/${id}`)).body.tableNumber).toBe(1);
  });

  it('une dos cuentas: las rondas pasan a la destino y la origen se cierra sin borrarse', async () => {
    const a = await withRound(1);
    const b = await withRound(2);
    expect((await as('Ana').post(`/accounts/${a}/merge`, { intoAccountId: b })).status).toBe(403);
    const r = await as('Dueño').post(`/accounts/${a}/merge`, { intoAccountId: b });
    expect(r.status).toBe(200);
    expect(r.body.rounds.map((x: { number: number }) => x.number)).toEqual([1, 2]);
    expect(r.body.subtotal).toBe(5000);
    const old = (await as('Ana').get(`/accounts/${a}`)).body;
    expect(old).toMatchObject({ status: 'pagada', mergedInto: b, invoiceId: null, rounds: [] });
    expect(await tableStatus(1)).toBe('libre');
    expect((await as('Ana').post(`/accounts/${a}/rounds`, { items: [{ productId: 1, qty: 1 }] }, key())).status).toBe(409);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'unir'").get() as { n: number };
    expect(n).toBe(1);
  });

  it('no une una cuenta consigo misma ni con una pagada', async () => {
    const a = await withRound(1);
    expect((await as('Cajero').post(`/accounts/${a}/merge`, { intoAccountId: a })).status).toBe(400);
    const b = await withRound(2);
    await as('Ana').post(`/accounts/${b}/request-bill`);
    await as('Cajero').post(`/accounts/${b}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' });
    expect((await as('Cajero').post(`/accounts/${a}/merge`, { intoAccountId: b })).status).toBe(409);
    expect((await as('Ana').get(`/accounts/${a}`)).body.rounds).toHaveLength(1);
  });
});

describe('editar ítem en ronda tomada (RF-33)', () => {
  const setup = async () => {
    const id = await openTable();
    const acc = (await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Aguardiente 1/2'), qty: 1 }] }, key())).body;
    return { id, roundId: acc.rounds[0].id as number, itemId: acc.rounds[0].items[0].id as number };
  };

  it('sube y baja la cantidad con ajustes de stock y cambia la nota', async () => {
    const { itemId } = await setup();
    expect(stock('Aguardiente 1/2')).toBe(1);
    const up = await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 2, note: ' con limón ' });
    expect(up.status).toBe(200);
    expect(up.body.rounds[0].items[0]).toMatchObject({ qty: 2, note: 'con limón' });
    expect(up.body.subtotal).toBe(90000);
    expect(stock('Aguardiente 1/2')).toBe(0);
    await as('Cajero').patch(`/rounds/items/${itemId}`, { qty: 1, note: '' });
    expect(stock('Aguardiente 1/2')).toBe(1);
    const moves = db.prepare("SELECT qty FROM stock_movements WHERE type = 'ajuste' ORDER BY id").all() as { qty: number }[];
    expect(moves.map((m) => m.qty)).toEqual([-1, 1]);
    expect(events).toContain('item:editado');
  });

  it('no sube más allá del stock y no toca nada (RN-08)', async () => {
    const { itemId } = await setup();
    const r = await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 3 });
    expect(r.status).toBe(409);
    expect(r.body.field).toBe('qty');
    expect(stock('Aguardiente 1/2')).toBe(1);
    expect((await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 0 })).status).toBe(400);
    expect((await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 1, note: 'x'.repeat(101) })).status).toBe(400);
  });

  it('barra no edita; tampoco se edita fuera de «tomado» ni con la cuenta por cobrar', async () => {
    const { id, roundId, itemId } = await setup();
    expect((await as('Preparador').patch(`/rounds/items/${itemId}`, { qty: 1 })).status).toBe(403);
    await as('Ana').post(`/accounts/${id}/request-bill`);
    expect((await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 1 })).status).toBe(409);
    await as('Cajero').post(`/accounts/${id}/reopen`);
    await as('Preparador').patch(`/rounds/${roundId}/status`, { status: 'preparacion' });
    expect((await as('Ana').patch(`/rounds/items/${itemId}`, { qty: 1 })).status).toBe(409);
  });
});

describe('anular factura (RF-44)', () => {
  const paid = async () => {
    const id = await openTable();
    const acc = (await as('Ana').post(`/accounts/${id}/rounds`, { items: [{ productId: pid('Club Colombia'), qty: 3 }, { productId: pid('Tinto'), qty: 2 }] }, key())).body;
    await as('Ana').post(`/rounds/items/${acc.rounds[0].items[1].id}/void`, { reason: 'No lo quiso' }); // el tinto ya volvió al stock
    await as('Ana').post(`/accounts/${id}/request-bill`);
    return (await as('Cajero').post(`/accounts/${id}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' })).body as { id: number; number: number; accountId: number };
  };

  it('solo el dueño, con motivo; devuelve lo vendido con referencia a la factura', async () => {
    const inv = await paid();
    expect((await as('Cajero').post(`/invoices/${inv.id}/void`, { reason: 'Error de cobro' })).status).toBe(403);
    expect((await as('Dueño').post(`/invoices/${inv.id}/void`, { reason: '' })).body.field).toBe('reason');
    expect(stock('Club Colombia')).toBe(27);
    const r = await as('Dueño').post(`/invoices/${inv.id}/void`, { reason: 'Error de cobro' });
    expect(r.status).toBe(200);
    expect(r.body.voided).toMatchObject({ by: 'Dueño', reason: 'Error de cobro' });
    expect(stock('Club Colombia')).toBe(30);
    expect(stock('Tinto')).toBe(120);
    const ref = db.prepare('SELECT COUNT(*) AS n FROM stock_movements WHERE reference = ?').get(`factura:${inv.number}`) as { n: number };
    expect(ref.n).toBe(1);
    expect((await as('Cajero').get(`/invoices?q=${inv.number}`)).body[0].voided).toBe(true);
    expect((await as('Ana').get(`/accounts/${inv.accountId}`)).body.status).toBe('pagada');
  });

  it('factura ya anulada → 409 sin devolver stock dos veces; el número no se reutiliza (RN-06)', async () => {
    const inv = await paid();
    await as('Dueño').post(`/invoices/${inv.id}/void`, { reason: 'Error de cobro' });
    expect((await as('Dueño').post(`/invoices/${inv.id}/void`, { reason: 'Otra vez' })).status).toBe(409);
    expect(stock('Club Colombia')).toBe(30);
    const id2 = await openTable(2);
    await as('Ana').post(`/accounts/${id2}/rounds`, { items: [{ productId: pid('Tinto'), qty: 1 }] }, key());
    await as('Ana').post(`/accounts/${id2}/request-bill`);
    expect((await as('Cajero').post(`/accounts/${id2}/charge`, { discount: '', tipPercent: '', method: 'tarjeta' })).body.number).toBe(inv.number + 1);
  });
});
