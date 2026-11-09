// npm run db:reset -w server — borra la base local de desarrollo y la vuelve a sembrar.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, openDb } from './index';
import { seed } from './seed';

for (const f of ['mirador.db', 'mirador.db-wal', 'mirador.db-shm']) rmSync(join(DATA_DIR, f), { force: true });
const db = openDb();
seed(db);
db.close();
console.log('Base reiniciada con datos de ejemplo.');
