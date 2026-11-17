import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BackupInfo, BackupKind } from '@mirador/shared';
import type { DB } from '../db/index';
import { HttpError, httpError } from './http';

/** RF-71: carpeta de copias (fuera del repo, ver .gitignore). Las pruebas pasan otra. */
export const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backups');

/** Copias automáticas que se conservan; las manuales y las de seguridad nunca se podan. */
export const KEEP_AUTO = 14;

// Patrón estricto: el id llega en la URL y solo así no puede apuntar fuera de la carpeta (`..`, `/`, `\`).
const NAME = /^mirador-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})(?:-(manual|seguridad))?\.db$/;

const p2 = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Nombre por fecha y hora local: mirador-2026-11-17_030000[-manual|-seguridad].db */
export function backupName(now: Date, kind: BackupKind): string {
  const time = `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
  return `mirador-${localDay(now)}_${time}${kind === 'auto' ? '' : `-${kind}`}.db`;
}

/** Lee un nombre de archivo; null si no es una copia de este sistema. */
export function parseBackupName(id: string): { id: string; kind: BackupKind; date: Date } | null {
  const m = NAME.exec(id);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  return { id, kind: (m[7] as BackupKind | undefined) ?? 'auto', date: new Date(y, mo - 1, d, h, mi, s) };
}

/** ¿Falta la copia automática del día (hora local)? */
export function needsDailyBackup(names: string[], now: Date): boolean {
  const today = localDay(now);
  return !names.some((n) => {
    const b = parseBackupName(n);
    return b?.kind === 'auto' && localDay(b.date) === today;
  });
}

/** Copias automáticas que sobran: todas menos las `keep` más recientes. */
export function backupsToPrune(names: string[], keep = KEEP_AUTO): string[] {
  return names
    .filter((n) => parseBackupName(n)?.kind === 'auto')
    .sort() // el nombre ordena por fecha
    .reverse()
    .slice(keep);
}

export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map(parseBackupName)
    .filter((b) => b !== null)
    .map((b) => ({ id: b.id, kind: b.kind, createdAt: b.date.toISOString(), size: statSync(join(dir, b.id)).size }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** Ruta de una copia existente a partir del id de la URL; 404 si no es válida o no existe. */
export function backupPath(dir: string, id: string): string {
  const file = parseBackupName(id) && join(dir, id);
  if (!file || !existsSync(file)) throw httpError(404, 'No se encontró esa copia');
  return file;
}

// Copias y restauraciones van de a una: una copia no debe leer la base a mitad de una restauración.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

async function backupNow(db: DB, dir: string, kind: BackupKind): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const id = backupName(new Date(), kind);
  const file = join(dir, id);
  if (existsSync(file)) throw httpError(409, 'Ya hay una copia de este mismo segundo. Espera un momento.');
  const tmp = `${file}.tmp`;
  try {
    // API de respaldo en línea de SQLite: copia consistente aunque la base esté abierta y en uso.
    await db.backup(tmp);
    // Un solo archivo autocontenido (sin -wal/-shm) para exportarlo y abrirlo de solo lectura.
    const out = new Database(tmp);
    out.pragma('journal_mode = DELETE');
    out.close();
    renameSync(tmp, file); // solo aparece en la lista cuando está completa
  } finally {
    rmSync(tmp, { force: true });
  }
  return id;
}

export const createBackup = (db: DB, dir: string, kind: BackupKind) => exclusive(() => backupNow(db, dir, kind));

/** Copia diaria: si hoy no hay copia automática la hace, y poda las viejas. Devuelve el id creado. */
export const runDailyBackup = (db: DB, dir: string, now = new Date()) =>
  exclusive(async () => {
    const names = existsSync(dir) ? readdirSync(dir) : [];
    if (!needsDailyBackup(names, now)) return null;
    const id = await backupNow(db, dir, 'auto');
    for (const old of backupsToPrune([...names, id])) rmSync(join(dir, old), { force: true });
    return id;
  });

/** Al arrancar y luego cada hora (sin cron): si cambió el día, hace la copia. */
export function startDailyBackups(db: DB, dir = BACKUP_DIR) {
  const tick = () => runDailyBackup(db, dir).then(
    (id) => id && console.log(`Copia diaria de la base: backups/${id}`),
    (e) => console.error('No se pudo hacer la copia diaria de la base:', e),
  );
  void tick();
  setInterval(tick, 60 * 60 * 1000).unref();
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;
const tablesOf = (db: DB, schema: string): string[] =>
  db.prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).pluck().all() as string[];
const columnsOf = (db: DB, schema: string, table: string): string[] =>
  (db.prepare(`PRAGMA ${schema}.table_info(${q(table)})`).all() as { name: string }[]).map((c) => c.name);

/** El archivo debe ser una base SQLite sana con las tablas de este sistema. Se abre de solo lectura. */
function checkBackupFile(db: DB, file: string) {
  let bk: Database.Database | undefined;
  try {
    bk = new Database(file, { readonly: true, fileMustExist: true });
    if (bk.pragma('integrity_check', { simple: true }) !== 'ok') throw httpError(400, 'La copia está dañada; no se puede restaurar');
    const have = new Set(tablesOf(bk, 'main'));
    if (tablesOf(db, 'main').some((t) => !have.has(t))) throw httpError(400, 'El archivo no es una copia de este sistema');
  } catch (e) {
    throw e instanceof HttpError ? e : httpError(400, 'El archivo no es una base de datos válida');
  } finally {
    bk?.close();
  }
}

/**
 * RF-71: reemplaza los datos actuales por los de la copia SIN cambiar la conexión que comparten los
 * módulos. Antes guarda una copia de seguridad. Todo va en una transacción: si algo falla, nada cambia.
 * `afterCopy` corre dentro de la transacción ya con los datos restaurados (para la auditoría).
 */
export const restoreBackup = (db: DB, dir: string, id: string, afterCopy: (safety: string) => void) =>
  exclusive(async () => {
    const file = backupPath(dir, id);
    checkBackupFile(db, file);
    const safety = await backupNow(db, dir, 'seguridad');
    // foreign_keys no tiene efecto dentro de una transacción ni ATTACH se permite en una: van afuera.
    db.pragma('foreign_keys = OFF');
    try {
      db.prepare('ATTACH DATABASE ? AS bk').run(file);
      try {
        db.transaction(() => {
          for (const t of tablesOf(db, 'main')) {
            // Columnas comunes: una copia de antes de una migración (p. ej. sin merged_into) también sirve.
            const old = new Set(columnsOf(db, 'bk', t));
            const cols = columnsOf(db, 'main', t).filter((c) => old.has(c)).map(q).join(', ');
            db.exec(`DELETE FROM main.${q(t)}`);
            db.exec(`INSERT INTO main.${q(t)} (${cols}) SELECT ${cols} FROM bk.${q(t)}`);
          }
          afterCopy(safety);
          if ((db.pragma('main.foreign_key_check') as unknown[]).length) throw httpError(400, 'La copia tiene datos inconsistentes; no se restauró');
        })();
      } finally {
        db.exec('DETACH DATABASE bk');
      }
    } finally {
      db.pragma('foreign_keys = ON');
    }
    return { safety };
  });
