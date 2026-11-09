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

// Adaptadores virtuales (WSL, Hyper-V, VirtualBox, VPN) que los celulares no pueden alcanzar.
const VIRTUAL = /vethernet|wsl|hyper-v|virtualbox|vmware|docker|loopback|tailscale|zerotier/i;

/** IPv4 de la red local; la del Wi-Fi o Ethernet real va primero. */
function lanAddresses(): { ip: string; name: string }[] {
  return Object.entries(networkInterfaces())
    .flatMap(([name, list]) => (list ?? []).map((a) => ({ ...a, name })))
    .filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.') && !VIRTUAL.test(a.name))
    .map((a) => ({ ip: a.address, name: a.name }))
    .sort((a, b) => Number(/wi-?fi|wlan|ethernet/i.test(b.name)) - Number(/wi-?fi|wlan|ethernet/i.test(a.name)));
}

http.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  const url = `http://${ips[0]?.ip ?? 'localhost'}:${PORT}`;
  console.log(`\n${getSettings(db).businessName} · servidor local listo`);
  console.log(`  Dirección para los celulares: ${url}`);
  for (const { ip, name } of ips.slice(1)) console.log(`  (otra red: http://${ip}:${PORT} · ${name})`);
  console.log(`  Prueba en el navegador del celular: ${url}/health`);
  console.log('\nEscanea este QR desde la pantalla de conexión de la app (RF-01):\n');
  qrcode.generate(url, { small: true });
});

const shutdown = () => { http.close(); db.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
