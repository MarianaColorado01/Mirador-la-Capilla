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
npm run app          # Metro de Expo; escanea su QR con Expo Go
```

La app usa sola la IP del PC donde corre Metro, con el puerto 3000. Solo si el servidor corre en otro PC, copia `app/.env.example` a `app/.env.local`, escribe su dirección y reinicia Metro con `npx expo start -c`.

Si la app no conecta, abre `http://<IP del PC>:3000/health` en el navegador del celular. Si tampoco carga ahí, el problema es la red: el celular no está en el mismo Wi-Fi, el firewall de Windows bloquea Node o la red aísla a los dispositivos entre sí.

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
- [x] Proceso principal: abrir mesa, rondas, barra, cobro y factura (servidor con pruebas de RN-01 a RN-09 y pantallas en la app)
- [x] Tiempo real con Socket.IO (cola de barra, aviso de ronda lista, stock bajo) e indicador conectado · reconectando · sin conexión
- [x] Cierre del proceso principal: mover y unir cuentas (RF-20), editar cantidad o nota en ronda tomada (RF-33), historial de facturas (RF-43) y anulación de factura por el dueño (RF-44)
- [x] Navegación y administración: menú lateral según rol con las pestañas adentro (RF-06), ajustes del negocio (RF-04), usuarios con PIN y desactivación (RF-07) y cierre de sesión por inactividad (RF-09)
- [x] Catálogo: detalle de producto con id inexistente (RF-12), crear/editar/desactivar productos con formulario validado (RF-13, RF-14), categorías (RF-15), mesas (RF-22) y mapper DTO → modelo en la app
- [x] Inventario: pestaña con stock y qué surtir (RF-47, RF-51), ajustes manuales con conteo físico (RF-48), historial filtrable (RF-49) y aviso de stock bajo al dueño (RF-50)
- [x] Proveedores y compras: crear, editar y desactivar proveedores (RF-52), registrar compra que sube el stock y actualiza el último costo en una transacción (RF-53, RF-54) e historial filtrable por proveedor y fechas con detalle (RF-55)
- [x] Gastos y resumen: registrar y listar gastos (RF-57), resumen Hoy / 7 días / Mes con ventas, costo de lo vendido, surtido aparte, otros gastos y utilidad estimada (RF-58), gráfica por día, más vendidos y ventas por mesero (RF-59) y margen por producto (RF-60)
- [x] Mapa y ubicación: pantalla Ubicación para todos con OpenStreetMap + Leaflet en WebView, bar, proveedores y el celular con marcadores distintos (RF-61, RF-62), «Mi ubicación» (RF-63), seguimiento con pausar/reanudar que se libera al salir (RF-64), permiso denegado, GPS apagado y mapa sin internet (RF-65) y «Ver en el mapa» desde el proveedor (RF-66)
- [x] Dividir pago: una factura con varios pagos (efectivo, tarjeta, transferencia), partes iguales con redondeo en el último, lo que falta por cubrir en vivo y cambio por pago en efectivo (RF-46)
- [x] Factura en PDF: «Compartir PDF» en el detalle de la factura la genera en el celular (sin servidor ni internet) y la comparte por WhatsApp, correo, etc. (RF-45)
- [x] Compras por proveedor: pestaña «Por proveedor» en Compras con total, % del total, número de compras, última fecha y productos principales por proveedor (incluidos inactivos) para Hoy / 7 días / Mes; al tocar uno se ve su historial (RF-56)
- [ ] Respaldos

Ver [documentacion/arquitectura.md](documentacion/arquitectura.md) para el plan por fases.
