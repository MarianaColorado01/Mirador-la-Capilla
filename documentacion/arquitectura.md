# Arquitectura

## Principios

1. **El servidor decide.** Stock, numeración de facturas y estados se validan en el servidor dentro de transacciones (RN-05). La app solo muestra y pide.
2. **Nada se borra** (RN-04). Las anulaciones guardan usuario, fecha y motivo, y `audit_log` registra los cambios.
3. **El stock solo cambia con movimientos** (RN-02). `products.stock` es una caché que se actualiza en la misma transacción que inserta el `stock_movement`.
4. **Precio y costo se congelan** en `round_items` y `purchase_items` (RN-03).
5. **Sin confirmaciones falsas.** Sin conexión, la app deshabilita las confirmaciones (RF-67). Al recibir un evento de Socket.IO, invalida las consultas de TanStack Query y vuelve a leer el servidor; nunca aplica a mano lo que trae el evento.

## Servidor (`server/`)

```
src/
├─ index.ts           arranque: base, semilla, HTTP, Socket.IO, IP y QR
├─ app.ts             createApp(db): rutas y manejo de errores (se prueba con base en memoria)
├─ realtime.ts        Socket.IO con el mismo JWT; salas por rol y por usuario
├─ db/schema.sql      todas las tablas
├─ db/index.ts        openDb(), getSettings(), saveSettings()
├─ db/seed.ts         datos de ejemplo (los de los mockups)
├─ lib/auth.ts        JWT, requireAuth, requireRole (RN-09)
├─ lib/http.ts        HttpError, route(), errorHandler (zod → 400 con campo)
└─ modules/           un archivo de rutas por módulo
```

Para agregar un módulo: crea `modules/<nombre>.routes.ts`, que exporta una función `(db) => Router`, y móntalo en `app.ts`.

### Endpoints planeados

| Módulo | Rutas | RF |
|---|---|---|
| auth | `GET /auth/profiles` · `POST /auth/login` ✅ | 05, 08 |
| products | `GET /products` · `GET /products/:id` ✅ · `POST/PATCH /products` | 10–15 |
| tables | `GET /tables` · `POST/PATCH /tables` | 16, 22 |
| accounts | `POST /accounts` · `GET /accounts/:id` · `/request-bill` · `/reopen` · `/move` · `/merge` | 17–21 |
| rounds | `POST /accounts/:id/rounds` (Idempotency-Key) · `PATCH /rounds/:id/status` · `PATCH /round-items/:id` · `POST /round-items/:id/void` | 23–37 |
| billing | `GET /accounts?status=por_cobrar` · `POST /accounts/:id/charge` · `GET /invoices` · `GET /invoices/:id` · `POST /invoices/:id/void` | 38–46 |
| inventory | `GET /inventory` · `POST /inventory/adjustments` · `GET /products/:id/movements` · `GET /inventory/suggestions` | 47–51 |
| suppliers / purchases | CRUD de `/suppliers` · `POST/GET /purchases` · `GET /reports/purchases-by-supplier` | 52–56 |
| expenses / reports | `POST/GET /expenses` · `GET /reports/summary?from&to` | 57–60 |
| settings / users / backups | `GET/PATCH /settings` · CRUD de `/users` · `GET/POST /backups` · `POST /backups/:id/restore` | 04, 07, 71 |

### Eventos de tiempo real

Están definidos en `shared/src/types.ts`, en `ServerEvents`: `ronda:creada`, `ronda:estado`, `item:anulado`, `mesa:actualizada` y `stock:bajo`. Se emiten con `emit(evento, payload, roles)` **después** de que la transacción se confirma.

## App (`app/`)

Rutas con Expo Router en `app/src/app/`, según el mapa de pantallas del documento:

```
_layout.tsx                 Stack raíz
setup.tsx                   conexión al servidor (IP o QR)
login.tsx                   perfil y PIN
(drawer)/_layout.tsx        menú lateral según rol
(drawer)/(tabs)/_layout.tsx Mesas · Barra · Caja · Inventario según rol
(drawer)/(tabs)/mesas.tsx … barra.tsx … caja.tsx … inventario.tsx
(drawer)/proveedores/…      ubicacion.tsx · gastos.tsx · dashboard.tsx · facturas.tsx · ajustes.tsx · usuarios.tsx
mesa/[id].tsx · mesa/[id]/ronda.tsx · producto/[id].tsx · factura/[id].tsx · compra/nueva.tsx
```

Librerías previstas: Axios con instancia central y TanStack Query para la red, Zustand con persistencia para la sesión y la ronda en construcción, NativeWind, `expo-camera` para el QR y `expo-location` con Leaflet en WebView para el mapa. Instálalas siempre con `npx expo install` para que coincidan con el SDK.

El diseño de referencia es `documentacion/wireframes/wireframes-mirador-tablero.html`, y el prototipo navegable está en `documentacion/wireframes/mockups/prototipo.html`.

## Fases

1. **Base** ✅: monorepo, esquema, semilla, login con PIN, productos, QR.
2. **Proceso principal:** mesas, rondas con transacción e idempotencia, barra, pedir cuenta, cobro y factura. En la app: setup, login, mesas, ronda, cuenta y cobro.
3. **Tiempo real y sin conexión:** Socket.IO en las pantallas y reintento al reconectar.
4. **Funciones complementarias:** inventario, proveedores y compras, gastos, resumen, mapa.
5. **Prioridad Baja:** respaldos, PDF, dividir cuenta, reportes.
