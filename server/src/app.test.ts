import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb, saveSettings, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';

let db: DB;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db);
});

const login = async (name: string, pin = DEMO_PIN) => {
  const { id } = db.prepare('SELECT id FROM users WHERE name = ?').get(name) as { id: number };
  return request(app).post('/auth/login').send({ userId: id, pin });
};

describe('servidor base', () => {
  it('GET /health responde con el nombre del negocio', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.business).toBe('Mirador La Capilla');
  });

  it('lista perfiles sin exponer el hash del PIN', async () => {
    const r = await request(app).get('/auth/profiles');
    expect(r.body).toHaveLength(6);
    expect(r.body[0]).not.toHaveProperty('pin_hash');
  });

  it('login correcto devuelve token con el rol (RF-05)', async () => {
    const r = await login('Ana');
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('mesero');
    expect(r.body.token).toBeTypeOf('string');
  });

  it('bloquea el perfil tras los intentos configurados (RF-08)', async () => {
    saveSettings(db, { maxPinAttempts: 2 });
    expect((await login('Luis', '0000')).status).toBe(401);
    expect((await login('Luis', '0000')).status).toBe(423);
    expect((await login('Luis')).status).toBe(423); // ni con el PIN correcto mientras dure
  });
});

describe('productos', () => {
  it('pide sesión', async () => {
    expect((await request(app).get('/products')).status).toBe(401);
  });

  it('el mesero no ve costos; el dueño sí (RF-12)', async () => {
    const mesero = (await login('Ana')).body.token;
    const dueno = (await login('Dueño')).body.token;
    const a = await request(app).get('/products').set('Authorization', `Bearer ${mesero}`);
    const b = await request(app).get('/products').set('Authorization', `Bearer ${dueno}`);
    expect(a.body[0]).not.toHaveProperty('cost');
    expect(b.body[0]).toHaveProperty('margin');
  });

  it('id inexistente responde «Producto no encontrado»', async () => {
    const t = (await login('Ana')).body.token;
    const r = await request(app).get('/products/999').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Producto no encontrado');
  });

  it('el stock inicial entra como movimiento (RN-02)', () => {
    const { s } = db.prepare("SELECT SUM(qty) AS s FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE p.name = 'Águila 330 ml'").get() as { s: number };
    expect(s).toBe(48);
  });
});
