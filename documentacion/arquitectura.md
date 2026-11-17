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
| products | `GET /products?q&categoryId&all=1` (all solo dueño) · `GET /products/:id` · `GET /products/:id/movements?limit&type` (dueño) · `POST /products` · `PATCH /products/:id` `{name?, categoryId?, price?, cost?, minStock?, imageUrl?, active?}` (dueño) ✅ | 10–14 |
| categories | `GET /categories` · `POST /categories` `{name}` · `PATCH /categories/:id` `{name?, active?}` (dueño) ✅ | 15 |
| tables | `GET /tables` (mapa) · `GET /tables/all` · `POST /tables` `{number, zone?}` · `PATCH /tables/:id` `{zone?, active?}` (dueño) ✅ | 16, 22 |
| accounts | `POST /accounts` · `GET /accounts/:id` · `/request-bill` · `/reopen` · `POST /accounts/:id/move` `{tableNumber}` · `POST /accounts/:id/merge` `{intoAccountId}` ✅ | 17–21 |
| rounds | `POST /accounts/:id/rounds` (Idempotency-Key) · `GET /rounds` · `PATCH /rounds/:id/status` · `POST /rounds/items/:itemId/void` · `PATCH /rounds/items/:itemId` `{qty, note}` ✅ | 23–37 |
| billing | `GET /accounts?status=por_cobrar` · `POST /accounts/:id/charge` `{discount, tipPercent, method, received?}` o `{discount, tipPercent, payments: [{method, amount, received?}]}` · `GET /invoices?q=` · `GET /invoices/:id` · `POST /invoices/:id/void` `{reason}` ✅ | 38–44, 46 |

Decisiones del bloque 5.1 (RF-46, dividir pago):

- **Formato:** `POST /accounts/:id/charge` acepta el formato de un solo pago (`method`, `received`) o `payments` (1 a 10). La app usa el primero en el cobro normal y el segundo al dividir.
- **Reglas** en `splitPayments` de shared (pruebas en `billing.test.ts`): el total sale de `calculateBill`; cada monto es entero > 0; la suma debe ser exactamente el total; en efectivo `received ≥ amount` y el cambio es por pago. Errores por campo: `payments.N.amount`, `payments.N.received` y `payments` (la suma no cuadra). `equalShares` reparte en partes iguales y la última absorbe el redondeo.
- **Servidor:** recalcula todo, inserta una fila de `payments` por pago en la misma transacción que la factura; si algo falla no queda nada.
- **Lecturas:** `Invoice.payments` trae `{method, amount, received, change}[]` y `Invoice.method` es el resumen (`mixto` con varios pagos). La lista de facturas agrupa por factura (sin filas duplicadas). Los reportes suman desde `invoices`, así que las ventas no se duplican.

Decisiones del bloque 5.2 (RF-45, factura en PDF):

- **Sin endpoint nuevo:** el PDF se arma en el celular con la factura ya cargada (`GET /invoices/:id`), así no depende del servidor ni de internet. `expo-print` (`printToFileAsync` con HTML) y `expo-sharing` (`shareAsync`, `application/pdf` / `com.adobe.pdf`); ambos vienen en Expo Go.
- **HTML en shared:** `invoiceHtml(invoice, businessName)` en `shared/src/invoice-html.ts`, función pura sin recursos externos y con `escapeHtml` en todo texto de usuario (pruebas en `invoice-html.test.ts`). Hoja A4 con una columna angosta tipo tirilla; ítems anulados tachados con su motivo; si la factura está anulada, sello «ANULADA» con motivo. `money`, `pad`, `clock` y `dateTime` pasaron a `shared/src/format.ts` (la app los reexporta desde `utils/format.ts`).

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

Decisiones del bloque 4.4:

- **Listado de stock (RF-47):** no hay `GET /inventory`; la pestaña Inventario reutiliza `GET /products?all=1`, muestra solo los activos y ordena primero los que están en o bajo el mínimo (agotados incluidos).
- **Ajustes manuales (RF-48):** esquema `StockAdjustmentSchema` en `shared/src/admin.ts`. `entrada` suma y `salida` resta `qty` (≥ 1). `ajuste` es un **conteo físico**: `qty` es el stock real contado (≥ 0) y el movimiento guarda la diferencia con signo. Motivo obligatorio (3 a 100 caracteres). Stock negativo → 409 `field: qty`; un conteo igual al stock → 409 (no se guarda un movimiento en cero). Referencia `manual`, auditado como `ajustar inventario`.
- **Historial (RF-49):** el detalle del producto filtra por tipo con `?type=`.
- **Aviso de stock bajo (RF-50):** `crossedMin(antes, después, mínimo)` en `server/src/lib/stock.ts` lo usan confirmar ronda, editar ítem y ajuste manual. Se emite `stock:bajo` con roles `[]` (solo el dueño) únicamente cuando el stock cruza el mínimo hacia abajo, una vez.
- **Sugerencia de surtido (RF-51):** entran los activos en o bajo el mínimo y los 5 más vendidos en 7 días. Vendido = ítems no anulados de cuentas con factura no anulada (por fecha de factura); una cuenta unida no tiene factura y sus rondas ya están en la destino, así que nada se cuenta dos veces. Sugerido = max(2 × mínimo, vendido en 7 días) − stock; si da 0 o menos no se muestra.

Decisiones del bloque 4.5:

- **Proveedores (RF-52):** esquemas `SupplierSchema`/`SupplierUpdateSchema` en `shared/src/admin.ts`: nombre obligatorio; teléfono (solo números, espacios, + y -), notas y dirección opcionales (vacío = null); latitud −90..90 y longitud −180..180, las dos o ninguna (en PATCH se mandan juntas). Desactivar es `active: false` (RN-04); un proveedor inactivo no recibe compras. Se audita como `crear/editar proveedor`.
- **Compras (RF-53, RF-54):** esquema `PurchaseSchema` (proveedor, fecha AAAA-MM-DD real y no futura según la fecha local, al menos un ítem) y `PurchaseItemSchema` (cantidad entera > 0, costo unitario entero > 0). `POST /purchases` hace todo en una transacción: compra, ítems, una `entrada` en `stock_movements` por ítem con referencia `compra:<id>` y motivo «Compra a <proveedor>» (RN-02), `products.stock` sube y `products.cost` pasa al costo de la compra. Los ítems de ronda guardan su `unit_cost` congelado (RN-03), así que nada vendido cambia. El total lo calcula el servidor (se ignora el del cliente). Un proveedor inactivo → 400 `field: supplierId`; un producto inactivo o inexistente → 400 `field: items.<n>.productId` y no queda nada guardado. Se audita como `crear compra`. No emite eventos: el stock solo sube.
- **Historial (RF-55):** filtros opcionales `supplierId`, `from` y `to` (incluidos); fechas mal escritas o un rango invertido → 400 con `field`. Orden: fecha y id descendentes, máximo 200. El detalle trae ítems con nombre, cantidad, costo unitario y total, el usuario y la fecha de registro.
- **App:** tras guardar una compra se invalidan `['products']` (listas, detalle, movimientos, inventario y «Qué surtir») y `['purchases']`. «Crear compra con esto» en «Qué surtir» abre `compra/nueva?surtir=1` con lo sugerido al último costo. El botón «Ver en el mapa» del proveedor abre `/ubicacion?supplierId=` (bloque 4.7).

Decisiones del bloque 4.6:

- **Gastos (RF-57):** esquema `ExpenseSchema` en `shared/src/admin.ts` (concepto obligatorio hasta 60 caracteres, monto entero > 0, fecha real y no futura; la fecha comparte la regla de compras). `POST /expenses` guarda en una transacción y audita `crear gasto`. `GET /expenses?from&to` lista el rango (ambos días incluidos, más reciente primero). No hay editar ni borrar (RN-04); la anulación con motivo queda pendiente.
- **Qué son las ventas (RF-58):** salen solo de facturas **no anuladas**, por el día local de la factura, nunca del estado de la cuenta (una cuenta unida queda pagada sin factura y sus rondas ya están en la otra). Ventas = Σ (subtotal − descuento): la propina es del personal y el impuesto no es ingreso del bar; ambos se devuelven aparte (`tips`, `taxes`). Costo de lo vendido = Σ qty × `unit_cost` congelado de ítems no anulados de esas cuentas. Utilidad = ventas − costo de lo vendido − otros gastos (`estimatedProfit`). Gasto en surtido = Σ compras con `date` en el rango; se informa y **no** se resta (sección 4.3). Ticket promedio = ventas / número de facturas, redondeado.
- **Rango:** `DateRangeSchema` (días locales AAAA-MM-DD, `from ≤ to`, si no 400 con `field: to`). Las fechas de SQLite están en UTC: se agrupa con `date(x, 'localtime')`. La app calcula el rango con `periodRange` de shared: Hoy; **7 días = los últimos 7 contando hoy**; Mes = del día 1 del mes actual a hoy.
- **Un solo endpoint (RF-59):** `GET /reports/summary` trae también `byDay` (solo días con ventas; la app rellena los demás con 0), `topProducts` (10 más vendidos por cantidad, importe = qty × precio antes del descuento de la factura) y `byWaiter` (mesero de la cuenta, ventas y número de facturas).
- **Margen (RF-60):** se calcula en la app con `margin` (precio − costo) de `GET /products?all=1` y el % sobre el precio; lista de productos activos ordenable por pesos o por %.
- **App:** la gráfica son barras con `View` (altura proporcional a la venta más alta, `accessibilityLabel` por barra, total del rango en texto; con más de 7 días solo se rotula cada 5.º día). Las claves del Resumen cuelgan de `['reports']` y se invalidan al guardar una compra o un gasto, al cobrar o mover cuentas (`useInvalidateFloor`) y al anular una factura.

Decisiones del bloque 4.7 (mapa y ubicación):

- **Proveedores en el mapa para todos (RF-61):** el RF pide «un marcador por proveedor registrado» con actor *Todos*, y `GET /suppliers` es solo del dueño. Se agregó `GET /suppliers/locations` (cualquier rol con sesión) que devuelve solo `{id, name, address, lat, lng}` de proveedores **activos con coordenadas**; teléfono, notas y compras siguen siendo del dueño. Va antes del `requireRole()` del router. Prueba en `purchases.test.ts` (cinco roles, filtro de inactivos/sin coordenadas y 401 sin sesión).
- **Mapa (`components/LeafletMap.tsx`):** WebView con una página fija de Leaflet 1.9.4 desde unpkg con SRI y teselas de `tile.openstreetmap.org` con la atribución de OSM visible. La página se carga una vez; la app manda `setPlaces`, `setDevice` y `focusOn` con `injectJavaScript` (mover el marcador o centrar no recarga) y la página responde con `postMessage`: `ready`, `tiles` o `error`. Si falla el script, 4 teselas seguidas sin ninguna buena o pasan 15 s sin teselas, se muestra «No se pudo cargar el mapa» con Reintentar (vuelve a montar la WebView) y la lista de lugares sigue útil (RF-65). Formas distintas además del color: bar = cuadrado ámbar, proveedor = rombo naranja, celular = círculo azul con círculo de precisión. Los nombres se ponen con `textContent` (sin HTML). Los enlaces (atribución) se abren en el navegador.
- **Permisos (`hooks/useLocationTracking.ts`):** solo primer plano (`expo-location` sin opciones de segundo plano en `app.json`, texto de permiso en español). `useFocusEffect` pide el permiso al entrar a la pantalla y, al salir, hace `subscription.remove()` y deja el seguimiento en pausa (el Drawer no desmonta la pantalla). `AppState` vuelve a revisar permiso y GPS (`hasServicesEnabledAsync`) al regresar de Ajustes, sin preguntar. Estados: verificando, sin responder, concedido, denegado (botón `Linking.openSettings()`), GPS apagado y error. «Mi ubicación» usa `getCurrentPositionAsync` y centra; «Seguirme / Pausar / Reanudar» usa `watchPositionAsync` (precisión alta, 5 s o 10 m).
- **RF-66:** el detalle del proveedor muestra «Ver en el mapa» solo si está activo y tiene coordenadas; abre `/ubicacion?supplierId=<id>` centrado en él con su etiqueta abierta. No se dibuja ninguna línea entre el bar y el proveedor. Si el id no está en la lista, aviso «Ese proveedor no tiene ubicación».
- **Accesibilidad:** la WebView no la lee el lector de pantalla, así que debajo hay una lista «Lugares» (bar, proveedores, tu posición) con coordenadas y dirección; cada fila centra el mapa.

| inventory | `POST /inventory/adjustments` `{productId, type, qty, reason}` · `GET /inventory/suggestions` (dueño); el listado usa `GET /products?all=1` y el historial `GET /products/:id/movements?type` ✅ | 47–51 |
| suppliers / purchases | `GET /suppliers/locations` (todos, RF-61) ✅ · `GET /suppliers` · `GET /suppliers/:id` · `POST /suppliers` `{name, phone?, notes?, address?, lat?, lng?}` · `PATCH /suppliers/:id` (lo mismo + `active`) · `POST /purchases` `{supplierId, date, items: [{productId, qty, unitCost}]}` · `GET /purchases?supplierId&from&to` · `GET /purchases/:id` (dueño) ✅ · `GET /reports/purchases-by-supplier` (RF-56, Baja, pendiente) | 52–56, 61 |
| expenses / reports | `POST /expenses` `{concept, amount, date}` · `GET /expenses?from&to` · `GET /reports/summary?from&to` (dueño) ✅; el margen (RF-60) usa `GET /products?all=1` | 57–60 |
| settings / users | `GET /settings` (todos) · `PATCH /settings` (dueño) · `GET /users` · `POST /users` `{name, role, pin}` · `PATCH /users/:id` `{name?, role?, pin?, active?}` (dueño) ✅ | 04, 07 |
| backups | `GET/POST /backups` · `POST /backups/:id/restore` | 71 |

### Eventos de tiempo real

Están definidos en `shared/src/types.ts`, en `ServerEvents`: `ronda:creada`, `ronda:estado`, `item:anulado`, `item:editado`, `mesa:actualizada` y `stock:bajo`. `stock:bajo` va solo al dueño (roles `[]`) tras confirmar ronda, editar ítem o ajuste manual. Mover y unir emiten `mesa:actualizada` para la mesa origen (libre) y la destino. Se emiten con `emit(evento, payload, roles)` **después** de que la transacción se confirma.

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
(drawer)/(tabs)/inventario.tsx  stock, búsqueda, categoría y qué surtir (dueño, RF-47/51)
(drawer)/facturas.tsx       historial de facturas (RF-43); también desde Caja
(drawer)/ajustes.tsx        ajustes del negocio (dueño, RF-04)
(drawer)/usuarios.tsx       crear, editar, desactivar usuarios (dueño, RF-07)
(drawer)/productos.tsx      lista de productos con inactivos, búsqueda y categoría (dueño, RF-13/14)
(drawer)/categorias.tsx     crear, renombrar, desactivar categorías (dueño, RF-15)
(drawer)/mesas.tsx          crear mesas, zona, desactivar (dueño, RF-22)
(drawer)/proveedores.tsx    lista de proveedores, nuevo proveedor y registrar compra (dueño, RF-52)
(drawer)/compras.tsx        historial de compras por proveedor y fechas (dueño, RF-55)
(drawer)/dashboard.tsx      Resumen: Hoy / 7 días / Mes, utilidad, gráfica por día, más vendidos, por mesero y margen (dueño, RF-58 a RF-60)
(drawer)/gastos.tsx         registrar gasto y lista por período (dueño, RF-57)
mesa/[id].tsx               cuenta de la mesa
mesa/[id]/ronda.tsx         tomar ronda
cobro/[id].tsx              cobrar (un pago o «Dividir pago», RF-46)
factura/[id].tsx            factura (el dueño la anula, RF-44; «Compartir PDF», RF-45)
producto/[id].tsx           detalle (RF-12); se abre desde Productos o con pulsación larga en la ronda
producto/editar.tsx         crear producto, o editar/desactivar con ?id= (dueño, RF-13/14)
producto/ajuste.tsx         entrada, salida o conteo físico con ?id= (dueño, RF-48)
proveedor/[id].tsx          detalle y edición de proveedor; /proveedor/nuevo para crear (dueño, RF-52)
compra/nueva.tsx            registrar compra con ?supplierId= o ?surtir=1 (dueño, RF-53/54)
compra/[id].tsx             detalle de una compra (dueño, RF-55)
(drawer)/ubicacion.tsx      mapa del bar, proveedores y el celular; ?supplierId= centra en un proveedor (todos, RF-61 a RF-66)
```

El cierre por inactividad (RF-09) lo hace `hooks/use-idle-logout.ts`: el View raíz captura cada toque (`onStartShouldSetResponderCapture`) y reinicia un temporizador de `idleLogoutMinutes`; al volver del segundo plano revisa el tiempo real transcurrido.

La pantalla de ubicación usa `components/LeafletMap.tsx` y `hooks/useLocationTracking.ts` (bloque 4.7). El Drawer viene incluido en `expo-router/drawer` desde el SDK 56: no hubo que instalar paquetes.

Librerías previstas: Axios con instancia central y TanStack Query para la red, Zustand con persistencia para la sesión y la ronda en construcción, NativeWind, `expo-camera` para el QR y `expo-location` con Leaflet en WebView para el mapa. Instálalas siempre con `npx expo install` para que coincidan con el SDK.

El diseño de referencia es `documentacion/wireframes/wireframes-mirador-tablero.html`, y el prototipo navegable está en `documentacion/wireframes/mockups/prototipo.html`.

## Fases

1. **Base** ✅: monorepo, esquema, semilla, login con PIN, productos, QR.
2. **Proceso principal** ✅: mesas, rondas con transacción e idempotencia, barra, pedir cuenta, cobro y factura. En la app: setup, login, mesas, ronda, cuenta y cobro.
3. **Tiempo real y sin conexión** ✅: Socket.IO invalida las consultas afectadas, avisos de ronda lista y stock bajo, refresco completo al reconectar.
4. **Funciones complementarias:** inventario, proveedores y compras, gastos, resumen, mapa.
5. **Prioridad Baja:** respaldos, PDF, dividir cuenta, reportes.
