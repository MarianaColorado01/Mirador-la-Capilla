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
├─ lib/auth.ts        JWT, requireAuth(db) (relee el usuario: inactivo → 401), requireRole (RN-09)
├─ lib/http.ts        HttpError, route(), errorHandler (zod → 400 con campo)
└─ modules/           un archivo de rutas por módulo
```

Para agregar un módulo: crea `modules/<nombre>.routes.ts`, que exporta una función `(db) => Router`, y móntalo en `app.ts`.

### Endpoints planeados

| Módulo | Rutas | RF |
|---|---|---|
| auth | `GET /auth/profiles` · `POST /auth/login` ✅ | 05, 08 |
| products | `GET /products?q&categoryId&all=1` (all solo dueño) · `GET /products/:id` · `GET /products/:id/movements?limit` (dueño) · `POST /products` · `PATCH /products/:id` `{name?, categoryId?, price?, cost?, minStock?, imageUrl?, active?}` (dueño) ✅ | 10–14 |
| categories | `GET /categories` · `POST /categories` `{name}` · `PATCH /categories/:id` `{name?, active?}` (dueño) ✅ | 15 |
| tables | `GET /tables` (mapa) · `GET /tables/all` · `POST /tables` `{number, zone?}` · `PATCH /tables/:id` `{zone?, active?}` (dueño) ✅ | 16, 22 |
| accounts | `POST /accounts` · `GET /accounts/:id` · `/request-bill` · `/reopen` · `POST /accounts/:id/move` `{tableNumber}` · `POST /accounts/:id/merge` `{intoAccountId}` ✅ | 17–21 |
| rounds | `POST /accounts/:id/rounds` (Idempotency-Key) · `GET /rounds` · `PATCH /rounds/:id/status` · `POST /rounds/items/:itemId/void` · `PATCH /rounds/items/:itemId` `{qty, note}` ✅ | 23–37 |
| billing | `GET /accounts?status=por_cobrar` · `POST /accounts/:id/charge` · `GET /invoices?q=` · `GET /invoices/:id` · `POST /invoices/:id/void` `{reason}` ✅ | 38–44 |

Decisiones del bloque 4.1:

- **Mover (RF-20):** caja, todo en uno o dueño. La mesa destino debe estar libre (409 si tiene cuenta, RN-01). La cuenta conserva id, rondas y mesero.
- **Unir (RF-20):** las rondas de la cuenta origen pasan a la destino, renumeradas a continuación. La origen no se borra (RN-04): queda en estado `pagada` sin factura, con `closed_at` y `merged_into` = cuenta destino, y su mesa queda libre. La destino conserva su estado. Se audita como `unir`.
- **Editar ítem (RF-33):** solo en ronda `tomado` con la cuenta `abierta`; mesero, todo en uno, caja o dueño. La diferencia de cantidad mueve el stock con un `ajuste` referencia `ronda:<id>`; al subir se valida el stock (RN-08, 409 con `field: qty`). Para quitar un ítem se sigue usando la anulación.
- **Anular factura (RF-44):** solo el dueño, con motivo. Lo vendido no anulado vuelve al stock con `ajuste` referencia `factura:<número>`; se guardan `voided_at`, `voided_by` y `void_reason`. El número no se reutiliza (RN-06). La cuenta sigue `pagada` y la mesa no se reabre. Una factura ya anulada responde 409.

Decisiones del bloque 4.2:

- **Ajustes (RF-04):** `PATCH /settings` acepta cualquier subconjunto; el esquema zod vive en `shared/src/admin.ts` y lo usan la app (errores en vivo) y el servidor (400 con `field`). Incluye `barLat`/`barLng` del bar (por defecto ≈ 4.99, −75.81, pendiente de confirmar). Se audita como `editar ajustes`.
- **Usuarios (RF-07):** nada se borra: desactivar es `active: false`. El dueño no puede desactivarse a sí mismo y ningún cambio puede dejar el sistema sin dueño activo (se revisa con el cambio ya aplicado, dentro de la transacción). No se repiten nombres entre perfiles activos. El PIN se guarda con bcrypt y uno nuevo quita el bloqueo por intentos.
- **Sesión:** `requireAuth(db)` relee nombre y rol por id en cada petición: un usuario desactivado recibe 401 (la app cierra su sesión) y un cambio de rol aplica de inmediato. El socket de tiempo real no se corta hasta que reconecta.

Decisiones del bloque 4.3:

- **Productos (RF-13, RF-14):** esquema `ProductSchema` en `shared/src/admin.ts` (nombre obligatorio, categoría activa, precio y costo enteros > 0, stock mínimo entero ≥ 0, imagen URL http(s) opcional; vacía = sin imagen). El stock no se edita: un producto nuevo arranca en 0 y sube con compra o ajuste (RN-02). Desactivar es `active: false`; los inactivos no salen en `GET /products` ni se pueden pedir en una ronda (409), pero el dueño los ve con `?all=1`.
- **Detalle (RF-12):** id inexistente o no numérico → 404 «Producto no encontrado»; la app tampoco consulta un id no numérico y no reintenta un 404. Los movimientos traen tipo, cantidad con signo, motivo, referencia, usuario y fecha (los reutiliza el inventario).
- **Categorías (RF-15):** nombre único sin importar mayúsculas (409 `field: name`). No se desactiva una categoría con productos activos (409 `field: active`), para que no queden productos a la venta en una categoría oculta.
- **Mesas (RF-22):** número único entre todas, también las inactivas (si existe inactiva, el mensaje pide reactivarla). No se desactiva una mesa con cuenta abierta o por cobrar (409). El número no se cambia después de crearla; la zona sí.
- **Mapper:** `app/src/services/mappers.ts` convierte el DTO (`Product` o `ProductOwnerView`) a `ProductModel` con `imageSource`, `cost`/`margin` (null si no es dueño), `outOfStock` y `lowStock`; lo usan `api.products` y `api.product`. Todas las claves de productos cuelgan de `['products']`, así que una ronda o una edición refresca listas, detalle y movimientos.
- Estos cambios del catálogo no emiten eventos de tiempo real: los otros celulares los ven al refrescar (productos cada 15 s al volver a la pantalla, mapa cada 30 s).
| inventory | `GET /inventory` · `POST /inventory/adjustments` · `GET /products/:id/movements` · `GET /inventory/suggestions` | 47–51 |
| suppliers / purchases | CRUD de `/suppliers` · `POST/GET /purchases` · `GET /reports/purchases-by-supplier` | 52–56 |
| expenses / reports | `POST/GET /expenses` · `GET /reports/summary?from&to` | 57–60 |
| settings / users | `GET /settings` (todos) · `PATCH /settings` (dueño) · `GET /users` · `POST /users` `{name, role, pin}` · `PATCH /users/:id` `{name?, role?, pin?, active?}` (dueño) ✅ | 04, 07 |
| backups | `GET/POST /backups` · `POST /backups/:id/restore` | 71 |

### Eventos de tiempo real

Están definidos en `shared/src/types.ts`, en `ServerEvents`: `ronda:creada`, `ronda:estado`, `item:anulado`, `item:editado`, `mesa:actualizada` y `stock:bajo`. Mover y unir emiten `mesa:actualizada` para la mesa origen (libre) y la destino. Se emiten con `emit(evento, payload, roles)` **después** de que la transacción se confirma.

## App (`app/`)

Rutas con Expo Router en `app/src/app/`. Hoy existen:

```
_layout.tsx                 Stack raíz (rutas protegidas según servidor y sesión)
setup.tsx                   conexión al servidor
login.tsx                   perfil y PIN
(drawer)/_layout.tsx        menú lateral según rol (lista ENTRIES con roles) + Cambiar de perfil
(drawer)/(tabs)/_layout.tsx pestañas según rol; el botón ☰ abre el menú
(drawer)/(tabs)/index.tsx   Mesas
(drawer)/(tabs)/barra.tsx · caja.tsx  Barra · Caja
(drawer)/facturas.tsx       historial de facturas (RF-43); también desde Caja
(drawer)/ajustes.tsx        ajustes del negocio (dueño, RF-04)
(drawer)/usuarios.tsx       crear, editar, desactivar usuarios (dueño, RF-07)
(drawer)/productos.tsx      lista de productos con inactivos, búsqueda y categoría (dueño, RF-13/14)
(drawer)/categorias.tsx     crear, renombrar, desactivar categorías (dueño, RF-15)
(drawer)/mesas.tsx          crear mesas, zona, desactivar (dueño, RF-22)
mesa/[id].tsx               cuenta de la mesa
mesa/[id]/ronda.tsx         tomar ronda
cobro/[id].tsx              cobrar
factura/[id].tsx            factura (el dueño la anula, RF-44)
producto/[id].tsx           detalle (RF-12); se abre desde Productos o con pulsación larga en la ronda
producto/editar.tsx         crear producto, o editar/desactivar con ?id= (dueño, RF-13/14)
```

El cierre por inactividad (RF-09) lo hace `hooks/use-idle-logout.ts`: el View raíz captura cada toque (`onStartShouldSetResponderCapture`) y reinicia un temporizador de `idleLogoutMinutes`; al volver del segundo plano revisa el tiempo real transcurrido.

Para el resto de la fase 4 están previstas las pantallas de inventario, proveedores, ubicación, gastos y resumen (se agregan como entradas del menú lateral), además de `compra/nueva.tsx`. El Drawer viene incluido en `expo-router/drawer` desde el SDK 56: no hubo que instalar paquetes.

Librerías previstas: Axios con instancia central y TanStack Query para la red, Zustand con persistencia para la sesión y la ronda en construcción, NativeWind, `expo-camera` para el QR y `expo-location` con Leaflet en WebView para el mapa. Instálalas siempre con `npx expo install` para que coincidan con el SDK.

El diseño de referencia es `documentacion/wireframes/wireframes-mirador-tablero.html`, y el prototipo navegable está en `documentacion/wireframes/mockups/prototipo.html`.

## Fases

1. **Base** ✅: monorepo, esquema, semilla, login con PIN, productos, QR.
2. **Proceso principal** ✅: mesas, rondas con transacción e idempotencia, barra, pedir cuenta, cobro y factura. En la app: setup, login, mesas, ronda, cuenta y cobro.
3. **Tiempo real y sin conexión** ✅: Socket.IO invalida las consultas afectadas, avisos de ronda lista y stock bajo, refresco completo al reconectar.
4. **Funciones complementarias:** inventario, proveedores y compras, gastos, resumen, mapa.
5. **Prioridad Baja:** respaldos, PDF, dividir cuenta, reportes.
