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
  rounds: Round[];
}

export interface Settings {
  businessName: string;
  taxPercent: number;
  suggestedTipPercent: number;
  singleOperator: boolean; // RF-04, RF-29
  maxPinAttempts: number; // RF-08
  lockMinutes: number;
  idleLogoutMinutes: number; // RF-09
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
