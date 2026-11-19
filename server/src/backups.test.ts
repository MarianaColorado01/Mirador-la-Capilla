/* RF-71: copias de la base, exportar y restaurar. Base en archivo temporal (backup necesita archivo). */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { getSettings, openDb, saveSettings, type DB } from './db/index';
import { DEMO_PIN, seed } from './db/seed';
import { backupName, backupsToPrune, needsDailyBackup, parseBackupName, runDailyBackup } from './lib/backups';

let tmp: string;
let dir: string;
let db: DB;
let app: ReturnType<typeof createApp>;
let events: string[];
const tokens: Record<string, string> = {};
const uid = (name: string) => (db.prepare('SELECT id FROM users WHERE name = ?').get(name) as { id: number }).id;
const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
const as = (who: string) => ({
  get: (url: string) => request(app).get(url).set(auth(who)),
  post: (url: string, body: object = {}) => request(app).post(url).set(auth(who)).send(body),
});
const expenses = () => db.prepare('SELECT concept FROM expenses ORDER BY id').pluck().all();
const addExpense = (concept: string) =>
  db.prepare("INSERT INTO expenses(concept, amount, date, user_id) VALUES(?, 1000, '2026-11-17', ?)").run(concept, uid('Dueño'));

beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'mirador-respaldos-'));
  dir = join(tmp, 'backups');
  db = openDb(join(tmp, 'mirador.db'));
  seed(db);
  events = [];
  app = createApp(db, (e) => events.push(e), dir);
  for (const name of ['Cajero', 'Dueño']) {
    tokens[name] = (await request(app).post('/auth/login').send({ userId: uid(name), pin: DEMO_PIN })).body.token;
  }
});

afterEach(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('copias (RF-71)', () => {
  it('solo el dueño las ve, crea, descarga y restaura (RN-09)', async () => {
    const id = (await as('Dueño').post('/backups')).body.id;
    expect((await as('Cajero').get('/backups')).status).toBe(403);
    expect((await as('Cajero').post('/backups')).status).toBe(403);
    expect((await as('Cajero').get(`/backups/${id}/download`)).status).toBe(403);
    expect((await as('Cajero').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' })).status).toBe(403);
    expect((await request(app).get('/backups')).status).toBe(401);
  });

  it('la copia manual crea un archivo válido y aparece en la lista con su tipo', async () => {
    addExpense('Hielo');
    const r = await as('Dueño').post('/backups');
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: expect.stringMatching(/-manual\.db$/), kind: 'manual', createdAt: expect.any(String), size: expect.any(Number) });
    expect(readdirSync(dir)).toEqual([r.body.id]); // sin .tmp ni -wal
    const copy = new Database(join(dir, r.body.id), { readonly: true });
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(copy.prepare('SELECT concept FROM expenses').pluck().all()).toEqual(['Hielo']);
    copy.close();

    await runDailyBackup(db, dir);
    const list = (await as('Dueño').get('/backups')).body as { kind: string }[];
    expect(list.map((b) => b.kind).sort()).toEqual(['auto', 'manual']);
    expect(db.prepare("SELECT COUNT(*) FROM audit_log WHERE entity = 'respaldo'").pluck().get()).toBe(1);
  });

  it('rechaza ids que no cumplen el patrón (sin recorrer rutas)', async () => {
    writeFileSync(join(tmp, 'secreto.db'), 'x');
    for (const id of ['..%2Fsecreto.db', '..%2F..%2Fmirador.db', 'secreto.db', 'mirador-2026-11-17_030000.db.tmp', 'mirador-2026-11-17_030000.db']) {
      expect((await as('Dueño').get(`/backups/${id}/download`)).status).toBe(404);
      expect((await as('Dueño').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' })).status).toBe(404);
    }
  });

  it('descarga el archivo para exportarlo', async () => {
    const { id, size } = (await as('Dueño').post('/backups')).body;
    const r = await as('Dueño').get(`/backups/${id}/download`).buffer(true).parse((res, cb) => {
      const parts: Buffer[] = [];
      res.on('data', (c: Buffer) => parts.push(c));
      res.on('end', () => cb(null, Buffer.concat(parts)));
    });
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain(id);
    expect((r.body as Buffer).length).toBe(size);
    expect((r.body as Buffer).subarray(0, 15).toString()).toBe('SQLite format 3');
  });
});

describe('restaurar (RF-71)', () => {
  it('pide escribir RESTAURAR', async () => {
    const { id } = (await as('Dueño').post('/backups')).body;
    for (const body of [{}, { confirm: 'restaurar' }, { confirm: true }]) {
      const r = await as('Dueño').post(`/backups/${id}/restore`, body);
      expect(r.status).toBe(400);
      expect(r.body.field).toBe('confirm');
    }
    expect(readdirSync(dir)).toHaveLength(1); // ni siquiera hizo la copia de seguridad
  });

  it('vuelve a los datos de la copia, deja una copia de seguridad y avisa a las apps', async () => {
    addExpense('Hielo');
    const { id } = (await as('Dueño').post('/backups')).body;
    addExpense('Limones');
    saveSettings(db, { taxPercent: 19 });
    expect(getSettings(db).taxPercent).toBe(19);

    const r = await as('Dueño').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' });
    expect(r.status).toBe(200);
    expect(expenses()).toEqual(['Hielo']);
    expect(getSettings(db).taxPercent).toBe(8);
    expect(r.body.safety).toMatch(/-seguridad\.db$/);
    expect(events).toEqual(['datos:restaurados']);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    // La copia de seguridad guarda lo que había antes de restaurar.
    const safety = new Database(join(dir, r.body.safety), { readonly: true });
    expect(safety.prepare('SELECT concept FROM expenses ORDER BY id').pluck().all()).toEqual(['Hielo', 'Limones']);
    safety.close();
    expect(db.prepare("SELECT action FROM audit_log WHERE entity = 'respaldo' ORDER BY id DESC LIMIT 1").pluck().get()).toBe('restaurar');
    // La app sigue funcionando con la misma conexión.
    expect((await as('Dueño').get('/expenses?from=2026-11-01&to=2026-11-30')).body).toHaveLength(1);
  });

  it.each([
    ['dañado', (f: string) => writeFileSync(f, 'esto no es una base de datos '.repeat(200))],
    ['ajeno', (f: string) => { const o = new Database(f); o.exec('CREATE TABLE fotos(id INTEGER)'); o.close(); }],
  ])('un archivo %s da 400 y los datos no cambian', async (_name, make) => {
    addExpense('Hielo');
    const id = 'mirador-2026-01-01_000000-manual.db';
    mkdirSync(dir);
    make(join(dir, id));
    const r = await as('Dueño').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' });
    expect(r.status).toBe(400);
    expect(expenses()).toEqual(['Hielo']);
    expect(events).toEqual([]);
    expect(readdirSync(dir).some((n) => n.includes('seguridad'))).toBe(false);
  });

  it('restaura una copia de antes de la migración merged_into', async () => {
    addExpense('Hielo');
    const { id } = (await as('Dueño').post('/backups')).body;
    const old = new Database(join(dir, id));
    old.exec(`PRAGMA foreign_keys = OFF;
      CREATE TABLE accounts_old AS SELECT id, table_id, waiter_id, status, opened_at, closed_at FROM accounts;
      DROP TABLE accounts; ALTER TABLE accounts_old RENAME TO accounts;`);
    expect(old.prepare('PRAGMA table_info(accounts)').all()).toHaveLength(6);
    old.close();
    addExpense('Limones');
    const r = await as('Dueño').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' });
    expect(r.status).toBe(200);
    expect(expenses()).toEqual(['Hielo']);
    expect((db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[]).map((c) => c.name)).toContain('merged_into');
  });

  it('si la copia rompe una llave foránea, revierte todo', async () => {
    addExpense('Hielo');
    const { id } = (await as('Dueño').post('/backups')).body;
    const bad = new Database(join(dir, id));
    bad.exec("PRAGMA foreign_keys = OFF; INSERT INTO expenses(concept, amount, date, user_id) VALUES('Fantasma', 1, '2026-11-17', 999)");
    bad.close();
    addExpense('Limones');
    expect((await as('Dueño').post(`/backups/${id}/restore`, { confirm: 'RESTAURAR' })).status).toBe(400);
    expect(expenses()).toEqual(['Hielo', 'Limones']);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('copia diaria y poda (RF-71)', () => {
  const at = (d: string) => new Date(`${d}T03:00:00`);

  it('nombres por fecha local y tipo', () => {
    expect(backupName(new Date(2026, 10, 17, 3, 5, 9), 'auto')).toBe('mirador-2026-11-17_030509.db');
    expect(backupName(new Date(2026, 10, 17, 3, 5, 9), 'seguridad')).toBe('mirador-2026-11-17_030509-seguridad.db');
    expect(parseBackupName('mirador-2026-11-17_030509-manual.db')?.kind).toBe('manual');
    expect(parseBackupName('../mirador-2026-11-17_030509.db')).toBeNull();
  });

  it('toca copia si hoy no hay una automática', () => {
    expect(needsDailyBackup([], at('2026-11-17'))).toBe(true);
    expect(needsDailyBackup(['mirador-2026-11-16_230000.db', 'mirador-2026-11-17_010000-manual.db'], at('2026-11-17'))).toBe(true);
    expect(needsDailyBackup(['mirador-2026-11-17_000100.db'], at('2026-11-17'))).toBe(false);
  });

  it('poda solo automáticas y deja las N más recientes', () => {
    const autos = Array.from({ length: 16 }, (_, i) => `mirador-2026-10-${String(i + 1).padStart(2, '0')}_030000.db`);
    const keep = [...autos, 'mirador-2026-09-01_000000-manual.db', 'mirador-2026-09-01_000000-seguridad.db', 'otro.txt'];
    expect(backupsToPrune(keep, 14)).toEqual([autos[1], autos[0]]);
    expect(backupsToPrune(autos.slice(0, 3), 14)).toEqual([]);
  });

  it('runDailyBackup crea la del día una sola vez y poda en disco', async () => {
    mkdirSync(dir);
    for (let i = 1; i <= 14; i++) writeFileSync(join(dir, `mirador-2026-10-${String(i).padStart(2, '0')}_030000.db`), '');
    writeFileSync(join(dir, 'mirador-2026-01-01_000000-manual.db'), '');
    const id = await runDailyBackup(db, dir);
    expect(id).toMatch(/^mirador-\d{4}-\d{2}-\d{2}_\d{6}\.db$/);
    expect(await runDailyBackup(db, dir)).toBeNull();
    const names = readdirSync(dir);
    expect(names.filter((n) => parseBackupName(n)?.kind === 'auto')).toHaveLength(14);
    expect(existsSync(join(dir, 'mirador-2026-10-01_030000.db'))).toBe(false);
    expect(names).toContain('mirador-2026-01-01_000000-manual.db');
  });
});
