import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';
import { createApp } from './app';
import { getSettings, openDb } from './db/index';
import { seed } from './db/seed';
import { attachRealtime } from './realtime';

const PORT = Number(process.env.PORT ?? 3000);

const db = openDb();
if (seed(db)) console.log('Base nueva: se cargaron los datos de ejemplo (PIN de prueba 1234).');

const app = createApp(db);
const http = createServer(app);
attachRealtime(http);

/** IPv4 de la red local (la que deben usar los celulares). */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a): a is NonNullable<typeof a> => !!a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

http.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  const url = `http://${ips[0] ?? 'localhost'}:${PORT}`;
  console.log(`\n${getSettings(db).businessName} · servidor local listo`);
  for (const ip of ips) console.log(`  → http://${ip}:${PORT}`);
  console.log('\nEscanea este QR desde la pantalla de conexión de la app (RF-01):\n');
  qrcode.generate(url, { small: true });
});

const shutdown = () => { http.close(); db.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
