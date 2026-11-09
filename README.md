# Mirador La Capilla · Bar POS

App de pedidos, cuentas, inventario y surtido para **Mirador La Capilla**, un mirador paisajístico cultural cafetero con restaurante y café bar (km 3 vía Belalcázar – La Virginia, vereda La Alemania).

Proyecto Final de Desarrollo Móvil II · Julian Hinestroza y Mariana Colorado Esguerra.

Funciona **sin internet**: un PC en la caja corre el servidor y la base de datos, y los celulares se conectan por el Wi-Fi del local.

```
 celulares (Expo)  ──Wi-Fi──►  PC de caja (Node + Express + SQLite + Socket.IO)
```

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `app/` | App móvil: React Native + Expo SDK 57 + TypeScript + Expo Router |
| `server/` | Servidor local: Express 5, SQLite (better-sqlite3), Socket.IO, JWT |
| `shared/` | Tipos y reglas que usan los dos, por ejemplo el cálculo del cobro (sección 4.3) |
| `documentacion/` | Requerimientos (PDF), arquitectura, wireframes, prototipo navegable y láminas de mockups |

## Requisitos

- Node.js 20.19 o superior (desarrollado con Node 24)
- Expo Go compatible con el SDK 57, o una build de desarrollo, en un celular Android conectado al mismo Wi-Fi que el PC

## Puesta en marcha

```bash
npm install          # instala app, server y shared (npm workspaces)
npm run server       # servidor en el puerto 3000; muestra la IP y un QR
```

En otra terminal:

```bash
cp app/.env.example app/.env.local   # pon la IP que mostró el servidor
npm run app                          # Metro de Expo; escanea su QR con Expo Go
```

Los datos de ejemplo se cargan solos la primera vez. Hay seis perfiles (Ana, Luis, Operador, Preparador, Cajero y Dueño), todos con el **PIN de prueba 1234**.

| Comando | Para qué |
|---|---|
| `npm test` | Pruebas de `shared` y `server` (vitest) |
| `npm run typecheck` | TypeScript en los tres paquetes |
| `npm run db:reset` | Borra la base local y vuelve a cargar los datos de ejemplo |

## Estado

- [x] Monorepo configurado (app, server, shared)
- [x] Servidor base: `/health`, perfiles, login con PIN y bloqueo, productos, Socket.IO autenticado, QR de conexión
- [x] Esquema completo de la base (mesas, cuentas, rondas, facturas, inventario, compras, gastos, auditoría)
- [x] Cálculo del cobro compartido, con pruebas
- [ ] Proceso principal: abrir mesa, rondas, barra, cobro y factura
- [ ] Tiempo real, modo sin conexión
- [ ] Inventario, compras, gastos, resumen, mapa
- [ ] Respaldos, PDF, dividir cuenta

Ver [documentacion/arquitectura.md](documentacion/arquitectura.md) para el plan por fases.
