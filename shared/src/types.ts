/* Modelo compartido. Los nombres siguen el documento de requerimientos (RF/RN). */

export type Role = 'todo' | 'mesero' | 'barra' | 'caja' | 'dueno';

export type TableStatus = 'libre' | 'ocupada' | 'por_cobrar'; // RF-16
export type AccountStatus = 'abierta' | 'por_cobrar' | 'pagada'; // RN-07
export type RoundStatus = 'tomado' | 'preparacion' | 'listo' | 'entregado'; // RF-30
export type MovementType = 'entrada' | 'salida' | 'ajuste'; // RN-02
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'; // RF-41

export interface Profile {
  id: number;
  name: string;
  role: Role;
}

export interface SessionUser extends Profile {
  token: string;
}

export interface Category {
  id: number;
  name: string;
  active: boolean;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  price: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  active: boolean;
}

/** Solo el dueño ve costo y margen (RF-12). */
export interface ProductOwnerView extends Product {
  cost: number;
  margin: number;
}

/** RF-12: movimiento de stock (entrada, salida o ajuste) visto por el dueño. */
export interface StockMovement {
  id: number;
  type: 'entrada' | 'salida' | 'ajuste';
  qty: number; // con signo: + entra, − sale
  reason: string | null;
  reference: string | null;
  user: string | null;
  createdAt: string;
}

/** RF-51: sugerencia de surtido. `suggested` = max(2 × mínimo, vendido en 7 días) − stock. */
export interface StockSuggestion {
  productId: number;
  name: string;
  categoryName: string;
  stock: number;
  minStock: number;
  sold7d: number;
  suggested: number;
  lowStock: boolean;
}

/** RF-52: proveedor. Las coordenadas van las dos o ninguna (se usan en el mapa, RF-61). */
export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
}

/** RF-55: compra en el historial. `date` es el día de la compra (AAAA-MM-DD). */
export interface PurchaseListItem {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  total: number;
  itemCount: number;
  user: string;
  createdAt: string;
}

/** RF-53 / RF-55: compra con sus ítems; `total` de cada ítem = qty × unitCost. */
export interface Purchase extends PurchaseListItem {
  items: { id: number; productId: number; name: string; qty: number; unitCost: number; total: number }[];
}

/** RF-22: mesa en la administración del dueño; `busy` = tiene cuenta abierta o por cobrar. */
export interface TableAdmin {
  id: number;
  number: number;
  zone: string | null;
  active: boolean;
  busy: boolean;
}

export interface RoundItem {
  id: number;
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number; // congelado al vender (RN-03)
  note: string | null; // máx. 100 caracteres (RF-25)
  voided: null | { by: string; at: string; reason: string; restocked: boolean };
}

export interface Round {
  id: number;
  number: number;
  status: RoundStatus;
  takenBy: string;
  createdAt: string;
  items: RoundItem[];
}

export interface Account {
  id: number;
  tableNumber: number;
  waiter: string;
  status: AccountStatus;
  openedAt: string;
  /** Σ de ítems no anulados de todas las rondas */
  subtotal: number;
  rounds: Round[];
  invoiceId: number | null;
  /** RF-20: si se unió a otra cuenta, el id de esa cuenta (esta queda cerrada sin factura). */
  mergedInto: number | null;
}

/** Mapa de mesas (RF-16). */
export interface TableSummary {
  number: number;
  zone: string | null;
  status: TableStatus;
  account: null | {
    id: number;
    waiter: string;
    waiterId: number;
    subtotal: number;
    openedAt: string;
    readyRounds: number;
  };
}

/** Comanda en la cola de barra (RF-31). */
export interface BarTicket {
  roundId: number;
  roundNumber: number;
  accountId: number;
  tableNumber: number;
  takenBy: string;
  status: RoundStatus;
  createdAt: string;
  items: RoundItem[];
}

/** Cuenta por cobrar en caja (RF-38). */
export interface BillableAccount {
  id: number;
  tableNumber: number;
  waiter: string;
  subtotal: number;
  rounds: number;
  voidedItems: number;
  openedAt: string;
}

export interface Invoice {
  id: number;
  number: number;
  accountId: number;
  tableNumber: number;
  waiter: string;
  cashier: string;
  subtotal: number;
  discount: number;
  tipPercent: number;
  tip: number;
  taxPercent: number;
  tax: number;
  total: number;
  method: PaymentMethod;
  received: number | null;
  change: number | null;
  createdAt: string;
  voided: null | { at: string; by: string; reason: string };
  items: RoundItem[];
}

/** Fila del historial de facturas (RF-43). */
export interface InvoiceListItem {
  id: number;
  number: number;
  total: number;
  createdAt: string;
  voided: boolean;
  tableNumber: number;
  method: PaymentMethod;
}

export interface CreateRoundRequest {
  items: { productId: number; qty: number; note?: string | null }[];
}

export interface ChargeRequest {
  discount: string;
  tipPercent: string;
  method: PaymentMethod;
  received?: string;
}

/** RF-33: cambiar cantidad o nota de un ítem en una ronda tomada. */
export interface EditItemRequest {
  qty: number;
  note: string | null;
}

export interface VoidItemRequest {
  reason: string;
  restock: boolean;
}

export interface Settings {
  businessName: string;
  taxPercent: number;
  suggestedTipPercent: number;
  singleOperator: boolean; // RF-04, RF-29
  maxPinAttempts: number; // RF-08
  lockMinutes: number;
  idleLogoutMinutes: number; // RF-09
  /** Ubicación del bar para el mapa (RF-61). */
  barLat: number;
  barLng: number;
}

/** Usuario visto desde Ajustes › Usuarios (RF-07). */
export interface ManagedUser extends Profile {
  active: boolean;
}

/** RF-57: gasto adicional. `date` es el día local AAAA-MM-DD. */
export interface Expense {
  id: number;
  concept: string;
  amount: number;
  date: string;
  user: string;
  createdAt: string;
}

/**
 * RF-58 / RF-59: resumen de un rango. Solo cuentan las facturas no anuladas. `sales` = subtotal − descuento:
 * la propina es del personal y el impuesto no es ingreso, por eso van aparte. `purchases` (gasto en surtido)
 * se informa pero no se resta: ya entra como costo de lo vendido (sección 4.3).
 */
export interface ReportSummary {
  from: string;
  to: string;
  sales: number;
  tips: number;
  taxes: number;
  costOfSales: number;
  purchases: number;
  otherExpenses: number;
  profit: number;
  invoiceCount: number;
  averageTicket: number;
  /** Solo los días con ventas; la app rellena los demás con 0. */
  byDay: { date: string; sales: number }[];
  /** Importe = cantidad × precio, antes del descuento de la factura. */
  topProducts: { productId: number; name: string; qty: number; amount: number }[];
  byWaiter: { waiterId: number; name: string; sales: number; invoices: number }[];
}

export interface HealthResponse {
  ok: true;
  business: string;
  version: string;
  time: string;
}

/** Eventos de tiempo real (RF-70). */
export interface ServerEvents {
  'ronda:creada': { accountId: number; roundId: number; tableNumber: number };
  'ronda:estado': { accountId: number; roundId: number; status: RoundStatus; takenBy: string; takenById: number };
  'item:anulado': { accountId: number; roundId: number; itemId: number };
  'item:editado': { accountId: number; roundId: number; itemId: number };
  'mesa:actualizada': { accountId: number; tableNumber: number; status: TableStatus };
  'stock:bajo': { productId: number; name: string; stock: number; minStock: number };
}

export interface ApiError {
  error: string;
  field?: string;
}
