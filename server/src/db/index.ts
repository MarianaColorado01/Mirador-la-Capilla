import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Settings } from '@mirador/shared';

export type DB = Database.Database;

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', '..', 'data');

/** Abre (o crea) la base. Con ':memory:' se usa en las pruebas. */
export function openDb(file = join(DATA_DIR, 'mirador.db')): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

const DEFAULT_SETTINGS: Settings = {
  businessName: 'Mirador La Capilla',
  taxPercent: 8,
  suggestedTipPercent: 10,
  singleOperator: true,
  maxPinAttempts: 3,
  lockMinutes: 5,
  idleLogoutMinutes: 10,
};

export function getSettings(db: DB): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(db: DB, patch: Partial<Settings>): void {
  const up = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) up.run(k, JSON.stringify(v));
  })();
}
