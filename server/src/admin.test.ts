/* Ajustes (RF-04) y usuarios (RF-07): solo el dueño, validaciones por campo y RN-04. */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { getSettings, openDb, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
const uid = (name: string) => (db.prepare('SELECT id FROM users WHERE name = ?').get(name) as { id: number }).id;

const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url: string, body: object) => request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

beforeEach(async () => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  for (const name of ['Ana', 'Cajero', 'Dueño']) {
    tokens[name] = (await request(app).post('/auth/login').send({ userId: uid(name), pin: DEMO_PIN })).body.token;
  }
});

describe('ajustes (RF-04)', () => {
  it('todos leen los ajustes, con la ubicación del bar', async () => {
    const r = await as('Ana').get('/settings');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ idleLogoutMinutes: 10, barLat: expect.any(Number), barLng: expect.any(Number) });
  });

  it('solo el dueño los cambia (RN-09)', async () => {
    expect((await as('Cajero').patch('/settings', { taxPercent: 19 })).status).toBe(403);
    const r = await as('Dueño').patch('/settings', { taxPercent: 19, businessName: '  Mirador  ', idleLogoutMinutes: 5, barLat: 4.98 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ taxPercent: 19, businessName: 'Mirador', idleLogoutMinutes: 5, barLat: 4.98, suggestedTipPercent: 10 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'ajustes'").get()).toEqual({ n: 1 });
  });

  it.each([
    [{ taxPercent: 101 }, 'taxPercent'],
    [{ suggestedTipPercent: -1 }, 'suggestedTipPercent'],
    [{ maxPinAttempts: 0 }, 'maxPinAttempts'],
    [{ lockMinutes: 2.5 }, 'lockMinutes'],
    [{ idleLogoutMinutes: '10' }, 'idleLogoutMinutes'],
    [{ barLat: 91 }, 'barLat'],
    [{ barLng: -181 }, 'barLng'],
    [{ businessName: ' ' }, 'businessName'],
  ])('rechaza %o con el campo que falló', async (body, field) => {
    const r = await as('Dueño').patch('/settings', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
    expect(getSettings(db).taxPercent).toBe(8);
  });
});

describe('usuarios (RF-07)', () => {
  it('solo el dueño lista y crea usuarios', async () => {
    expect((await as('Cajero').get('/users')).status).toBe(403);
    expect((await as('Ana').post('/users', { name: 'Sofía', role: 'mesero', pin: '4321' })).status).toBe(403);
    const list = await as('Dueño').get('/users');
    expect(list.body).toHaveLength(6);
    expect(list.body[0]).not.toHaveProperty('pin_hash');
  });

  it('crea un usuario que entra con su PIN (guardado con bcrypt)', async () => {
    const r = await as('Dueño').post('/users', { name: 'Sofía', role: 'mesero', pin: '4321' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: expect.any(Number), name: 'Sofía', role: 'mesero', active: true });
    const hash = (db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(r.body.id) as { pin_hash: string }).pin_hash;
    expect(hash).not.toBe('4321');
    expect((await request(app).post('/auth/login').send({ userId: r.body.id, pin: '4321' })).status).toBe(200);
  });

  it('valida nombre, rol y PIN de 4 dígitos', async () => {
    expect((await as('Dueño').post('/users', { name: 'Sofía', role: 'mesero', pin: '12' })).body.field).toBe('pin');
    expect((await as('Dueño').post('/users', { name: 'Sofía', role: 'chef', pin: '1234' })).body.field).toBe('role');
    expect((await as('Dueño').post('/users', { name: 'S', role: 'mesero', pin: '1234' })).body.field).toBe('name');
    const dup = await as('Dueño').post('/users', { name: 'ana', role: 'caja', pin: '1234' });
    expect(dup.status).toBe(409);
    expect(dup.body.field).toBe('name');
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(6);
  });

  it('edita nombre, rol y PIN; el PIN nuevo reemplaza al anterior', async () => {
    const r = await as('Dueño').patch(`/users/${uid('Ana')}`, { name: 'Ana María', role: 'caja', pin: '9999' });
    expect(r.body).toMatchObject({ name: 'Ana María', role: 'caja' });
    expect((await request(app).post('/auth/login').send({ userId: r.body.id, pin: DEMO_PIN })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ userId: r.body.id, pin: '9999' })).body.role).toBe('caja');
  });

  it('desactivar no borra y corta la sesión del usuario (RN-04)', async () => {
    expect((await as('Ana').get('/tables')).status).toBe(200);
    const r = await as('Dueño').patch(`/users/${uid('Ana')}`, { active: false });
    expect(r.body.active).toBe(false);
    expect((await as('Ana').get('/tables')).status).toBe(401);
    expect((await request(app).get('/auth/profiles')).body.map((p: { name: string }) => p.name)).not.toContain('Ana');
    expect((await as('Dueño').get('/users')).body).toHaveLength(6);
    await as('Dueño').patch(`/users/${uid('Ana')}`, { active: true });
    expect((await as('Ana').get('/tables')).status).toBe(200);
  });

  it('el cambio de rol aplica desde la siguiente petición', async () => {
    await as('Dueño').patch(`/users/${uid('Cajero')}`, { role: 'mesero' });
    expect((await as('Cajero').get('/invoices')).status).toBe(403);
  });

  it('el dueño no puede desactivarse ni dejar el sistema sin dueño activo', async () => {
    const me = uid('Dueño');
    expect((await as('Dueño').patch(`/users/${me}`, { active: false })).status).toBe(409);
    const r = await as('Dueño').patch(`/users/${me}`, { role: 'caja' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/al menos un dueño/);
    expect((db.prepare('SELECT role FROM users WHERE id = ?').get(me) as { role: string }).role).toBe('dueno');
  });

  it('usuario inexistente → 404', async () => {
    expect((await as('Dueño').patch('/users/999', { name: 'Nadie' })).status).toBe(404);
  });
});
