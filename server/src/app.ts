import cors from 'cors';
import express from 'express';
import type { HealthResponse } from '@mirador/shared';
import { getSettings, type DB } from './db/index';
import { noopEmit, type Emit } from './lib/events';
import { errorHandler } from './lib/http';
import { accountRoutes } from './modules/accounts.routes';
import { authRoutes } from './modules/auth.routes';
import { invoiceRoutes } from './modules/invoices.routes';
import { productRoutes } from './modules/products.routes';
import { roundRoutes } from './modules/rounds.routes';
import { settingsRoutes } from './modules/settings.routes';
import { tableRoutes } from './modules/tables.routes';
import { userRoutes } from './modules/users.routes';

export const VERSION = '0.2.0';

const ENDPOINTS = ['/health', '/auth/profiles', '/auth/login', '/settings', '/products', '/tables', '/accounts', '/rounds', '/invoices', '/users'];

/**
 * Crea la app Express. Recibe la base (en las pruebas, una en memoria) y la
 * función que emite eventos de tiempo real (en las pruebas, una que no hace nada).
 */
export function createApp(db: DB, emit: Emit = noopEmit) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Abrir http://IP:3000 en un navegador muestra que el servidor está vivo.
  app.get('/', (_req, res) => {
    res.json({ ok: true, business: getSettings(db).businessName, version: VERSION, endpoints: ENDPOINTS });
  });

  // La app lo usa en /setup para probar la conexión antes de guardarla (RF-01).
  app.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, business: getSettings(db).businessName, version: VERSION, time: new Date().toISOString() };
    res.json(body);
  });

  app.use('/auth', authRoutes(db));
  app.use('/settings', settingsRoutes(db));
  app.use('/users', userRoutes(db));
  app.use('/products', productRoutes(db));
  app.use('/tables', tableRoutes(db));
  app.use('/accounts', accountRoutes(db, emit));
  app.use('/rounds', roundRoutes(db, emit));
  app.use('/invoices', invoiceRoutes(db));
  // Próximos módulos: /inventory, /suppliers, /purchases, /expenses, /reports, /backups

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);
  return app;
}
