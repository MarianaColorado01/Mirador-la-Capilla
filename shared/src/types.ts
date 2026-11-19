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
}

/** Mapa de mesas (RF-16). */
export interface TableSummary {
  number: number;
  zone: string | null;
  status: TableStatus;
  account: null | {
    id: number;
    waiter: string;
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

export interface CreateRoundRequest {
  items: { productId: number; qty: number; note?: string | null }[];
}

export interface ChargeRequest {
  discount: string;
  tipPercent: string;
  method: PaymentMethod;
  received?: string;
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
  /** Ubicación del bar para el mapa (RF-61). Aproximada hasta confirmarla con el docente. */
  barLat: number;
  barLng: number;
  barAddress: string;
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
  'ronda:estado': { accountId: number; roundId: number; status: RoundStatus; takenBy: string };
  'item:anulado': { accountId: number; roundId: number; itemId: number };
  'mesa:actualizada': { tableNumber: number; status: TableStatus };
  'stock:bajo': { productId: number; name: string; stock: number; minStock: number };
}

export interface ApiError {
  error: string;
  field?: string;
}

/* ---------- Fase 4: inventario, surtido, gastos y resumen ---------- */

export interface Category {
  id: number;
  name: string;
  active: boolean;
  products: number;
}

export interface StockMovement {
  id: number;
  type: MovementType;
  qty: number;
  reason: string | null;
  reference: string | null;
  user: string | null;
  createdAt: string;
}

export interface RestockSuggestion {
  productId: number;
  name: string;
  stock: number;
  minStock: number;
  soldLast7Days: number;
  suggestedQty: number;
  supplierId: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  notes: string;
  address: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  lastPurchase: { date: string; total: number } | null;
}

export interface PurchaseItem {
  productId: number;
  productName: string;
  qty: number;
  unitCost: number;
  total: number;
}

export interface Purchase {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  total: number;
  user: string;
  items: PurchaseItem[];
}

export interface Expense {
  id: number;
  concept: string;
  amount: number;
  date: string;
  user: string;
}

export interface SummaryReport {
  from: string;
  to: string;
  sales: number; // ventas netas (subtotal − descuento) de facturas no anuladas
  costOfSales: number;
  otherExpenses: number;
  purchases: number; // surtido: se reporta aparte, no se resta (sección 4.3)
  profit: number;
  invoices: number;
  salesByDay: { date: string; sales: number }[];
  topProducts: { productId: number; name: string; qty: number; sales: number }[];
  salesByWaiter: { waiter: string; sales: number; invoices: number }[];
  margins: { productId: number; name: string; price: number; cost: number; margin: number }[];
}

export interface PurchasesBySupplier {
  supplierId: number;
  name: string;
  purchases: number;
  total: number;
}
