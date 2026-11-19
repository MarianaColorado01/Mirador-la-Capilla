/* RF-31 / RF-32 / RF-70: los cambios llegan solos a los celulares por Socket.IO. */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';
import type { Emit } from './lib/events';
import { noopEmit } from './lib/events';
import { attachRealtime } from './realtime';

let db: DB;
let http: Server;
let base: string;
const sockets: Socket[] = [];

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  let emitRef: Emit = noopEmit;
  http = createServer(createApp(db, (e, p, r) => emitRef(e, p, r)));
  emitRef = attachRealtime(http).emit;
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await new Promise((ok) => http.close(ok));
  db.close();
});

async function token(name: string) {
  const { id } = db.prepare('SELECT id FROM users WHERE name = ?').get(name) as { id: number };
  const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: id, pin: DEMO_PIN }) });
  return ((await r.json()) as { token: string }).token;
}

function client(tok: string): Promise<Socket> {
  const s = connect(base, { auth: { token: tok }, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  return new Promise((ok, fail) => {
    s.on('connect', () => ok(s));
    s.on('connect_error', fail);
  });
}

const next = <T>(s: Socket, event: string) => new Promise<T>((ok) => s.once(event, ok));

const post = async (tok: string, url: string, body: object, headers: Record<string, string> = {}) =>
  fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}`, ...headers }, body: JSON.stringify(body) });

describe('tiempo real', () => {
  it('rechaza conexiones sin token válido', async () => {
    await expect(client('no-es-un-token')).rejects.toThrow(/No autorizado/);
  });

  it('barra recibe la ronda nueva y el mesero el aviso de «lista»', async () => {
    const ana = await token('Ana');
    const prep = await token('Preparador');
    const barra = await client(prep);
    const mesero = await client(ana);

    const acc = (await (await post(ana, '/accounts', { tableNumber: 6 })).json()) as { id: number };
    const created = next<{ tableNumber: number; roundId: number }>(barra, 'ronda:creada');
    await post(ana, `/accounts/${acc.id}/rounds`, { items: [{ productId: 1, qty: 1 }] }, { 'Idempotency-Key': 'tiempo-real-0001' });
    const ev = await created;
    expect(ev.tableNumber).toBe(6);

    // Se guardan todos los eventos: «preparacion» y «listo» pueden llegar casi juntos.
    const seen: { status: string; takenBy: string }[] = [];
    const gotListo = new Promise<void>((ok) =>
      mesero.on('ronda:estado', (e: { status: string; takenBy: string }) => {
        seen.push(e);
        if (e.status === 'listo') ok();
      }),
    );
    for (const status of ['preparacion', 'listo']) {
      await fetch(`${base}/rounds/${ev.roundId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${prep}` }, body: JSON.stringify({ status }) });
    }
    await gotListo;
    expect(seen.map((e) => e.status)).toEqual(['preparacion', 'listo']);
    expect(seen[1].takenBy).toBe('Ana');
  });

  it('el aviso de stock bajo llega solo al dueño (RF-50)', async () => {
    const ana = await token('Ana');
    const dueno = await client(await token('Dueño'));
    const mesero = await client(ana);
    let meseroGotIt = false;
    mesero.on('stock:bajo', () => (meseroGotIt = true));

    const acc = (await (await post(ana, '/accounts', { tableNumber: 7 })).json()) as { id: number };
    const low = next<{ name: string; stock: number }>(dueno, 'stock:bajo');
    await post(ana, `/accounts/${acc.id}/rounds`, { items: [{ productId: 1, qty: 36 }] }, { 'Idempotency-Key': 'tiempo-real-0002' });
    expect(await low).toMatchObject({ name: 'Águila 330 ml', stock: 12 });
    await new Promise((r) => setTimeout(r, 100));
    expect(meseroGotIt).toBe(false);
  });
});
