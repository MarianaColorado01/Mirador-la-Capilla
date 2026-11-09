import cors from 'cors';
import express from 'express';
import type { HealthResponse } from '@mirador/shared';
import { getSettings, type DB } from './db/index';
import { errorHandler } from './lib/http';
import { authRoutes } from './modules/auth.routes';
import { productRoutes } from './modules/products.routes';

export const VERSION = '0.1.0';

/** Crea la app Express. Recibe la base para poder probarla con una base en memoria. */
export function createApp(db: DB) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // La app lo usa en /setup para probar la conexión antes de guardarla (RF-01).
  app.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, business: getSettings(db).businessName, version: VERSION, time: new Date().toISOString() };
    res.json(body);
  });

  app.use('/auth', authRoutes(db));
  app.use('/products', productRoutes(db));
  // Próximos módulos: /tables, /accounts, /rounds, /invoices, /inventory, /suppliers, /purchases, /expenses, /reports, /backups

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);
  return app;
}
