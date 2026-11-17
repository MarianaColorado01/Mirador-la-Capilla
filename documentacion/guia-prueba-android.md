# Guía de prueba en un teléfono Android

Lista para la «Revisión en teléfono Android» que pide la matriz de trazabilidad. Cada fila es una evidencia del curso: qué hacer, qué debe pasar y dónde está el código para explicarlo. Marca ✅ o anota lo que falló.

## Antes de empezar

1. En el PC: `npm install` y `npm run server`. Anota la IP que muestra.
2. En otra terminal: `npm run app` y escanea el QR con **Expo Go** (compatible con SDK 57) en un celular conectado al **mismo Wi-Fi**.
3. Si no conecta, abre `http://<IP>:3000/health` en el navegador del celular (ver README).
4. Datos de ejemplo: perfiles Ana, Luis, Operador, Preparador, Cajero y Dueño, todos con PIN **1234**. Para empezar de cero: `npm run db:reset`.

## Evidencias del curso

| ✔ | Requisito | Qué hacer | Qué debe pasar | Código |
|---|---|---|---|---|
| | Proceso principal completo | Mesero: abrir mesa, dos rondas · Barra: preparar y marcar lista · Caja: cobrar y ver la factura | La mesa pasa de libre a ocupada, por cobrar y libre; la factura sale con número consecutivo | `(drawer)/(tabs)/index.tsx`, `mesa/[id].tsx`, `cobro/[id].tsx` |
| | Dos funciones complementarias | Dueño: registrar una compra, ver el inventario y luego el Resumen | El stock sube y la compra aparece como gasto en surtido | `compra/nueva.tsx`, `(drawer)/(tabs)/inventario.tsx`, `(drawer)/dashboard.tsx` |
| | Stack | Mesas → cuenta → ronda, y volver con atrás | Navega y retrocede sin perder la ronda | `app/src/app/_layout.tsx` |
| | Tabs por rol | Entrar como Ana (mesero), Preparador (barra), Cajero y Dueño | Cada rol ve solo sus pestañas | `(drawer)/(tabs)/_layout.tsx` |
| | Drawer | Como Dueño, abrir cada opción del menú lateral | Cada opción abre una función real | `(drawer)/_layout.tsx` |
| | Ruta dinámica e id inexistente | Abrir un producto; luego un id que no existe (ej. `/producto/9999`) | Detalle correcto / «Producto no encontrado» con Volver | `producto/[id].tsx`, `mesa/[id].tsx`, `factura/[id].tsx` |
| | NativeWind, fuente, iconos y áreas seguras | Recorrer las pantallas en un celular con notch o barra de gestos | Fuentes Barlow Condensed e Inter, nada tapado por la barra de estado ni la de gestos | `tailwind.config.js`, `src/tokens.json`, `app/src/app/_layout.tsx`, `components/Screen.tsx` |
| | Tres componentes reutilizables | Señalar `ProductCard`, `QuantityCounter`, `StateView`, `AppButton` en varias pantallas | Mismo componente en varias pantallas | `app/src/components/` |
| | Listas, tarjetas y búsqueda | En la ronda: filtrar por categoría y buscar algo que no exista | Filtra; sale el estado vacío | `mesa/[id]/ronda.tsx` |
| | useState, useEffect y hook propio | Explicar el hook de ubicación y el de inactividad | Entradas, estado, efectos y resultado | `hooks/useLocationTracking.ts`, `hooks/use-idle-logout.ts` |
| | Zustand | Armar una ronda, cerrar la app por completo y reabrir | La ronda en construcción sigue ahí | `store/round-drafts.ts`, `store/session.ts` |
| | Contador contextual | Subir la cantidad de un producto hasta el stock | No pasa del stock y el total se actualiza | `components/QuantityCounter.tsx` |
| | Cálculo contextual | En cobro: descuento vacío, «abc», negativo y mayor que el subtotal | Vacío cuenta como 0; los demás muestran su error | `shared/src/billing.ts` |
| | Formulario con validaciones | Producto nuevo y compra nueva con campos mal | Mensaje debajo de cada campo | `producto/editar.tsx`, `compra/nueva.tsx` |
| | Axios con servicio central | Cambiar de servidor en la pantalla de conexión | Todas las consultas usan la nueva dirección | `services/api.ts` |
| | Consulta de listado y detalle | Catálogo y detalle de producto | `GET /products` y `GET /products/:id` | `services/api.ts`, `hooks/queries.ts` |
| | Interfaces y mapper | Explicar el paso del DTO al modelo interno | Imagen alternativa, margen y stock bajo calculados | `services/mappers.ts` |
| | TanStack Query | Apagar el servidor con una lista abierta y pulsar Reintentar | Carga, error con Reintentar y vacío | `hooks/queries.ts`, `components/StateView.tsx` |
| | Conservación de la información | Cobrar, cerrar la app, reabrir y buscar la factura | La factura sigue ahí | `server/src/db/` |
| | Mapa, marcadores y GPS | Abrir Ubicación y pulsar «Mi ubicación» | El marcador del bar es distinto al del celular | `(drawer)/ubicacion.tsx`, `components/LeafletMap.tsx` |
| | Permisos y limpieza | Negar el permiso, ir a ajustes, darlo y volver; pausar el seguimiento y salir | Mensaje y botón a ajustes; vuelve a revisar al regresar; libera el GPS al salir | `hooks/useLocationTracking.ts` |
| | Sin conexión y recuperación | Apagar el Wi-Fi a mitad de una ronda y volver a conectarlo | Indicador «sin conexión», confirmar deshabilitado, todo se refresca al volver | `hooks/queries.ts` (`useConnection`), `hooks/use-realtime.ts` |
| | Prueba con el cliente | Llenar la bitácora en el local | Tareas, resultados, dificultades y ajustes | `documentacion/bitacora.md` |

## Funciones de la fase 5

| ✔ | Qué hacer | Qué debe pasar |
|---|---|---|
| | Caja: «Dividir pago» entre 2 personas | No deja cobrar hasta que la suma dé el total; la factura lista cada pago |
| | Abrir una factura y «Compartir PDF» | Se abre el menú de compartir con el PDF |
| | Dueño: Compras › Por proveedor | Totales por proveedor del período |
| | Dueño: Respaldos › Hacer copia ahora › Exportar | Se comparte el archivo `.db` |
| | Dueño: Respaldos › Restaurar (escribiendo RESTAURAR) **solo con datos de prueba** | Los datos vuelven a los de esa copia y aparece una copia «seguridad» |

## Problemas encontrados

| Pantalla | Qué pasó | Celular | Captura |
|---|---|---|---|
| | | | |
