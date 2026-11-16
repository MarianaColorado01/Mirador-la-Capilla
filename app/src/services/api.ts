import { AxiosError, create, type AxiosInstance } from 'axios';
import type {
  Account, BarTicket, BillableAccount, Category, ChargeRequest, CreateRoundRequest, EditItemRequest, Expense, HealthResponse, Invoice, InvoiceListItem, ManagedUser, Profile,
  Purchase, PurchaseListItem, ReportSummary, Role, RoundStatus, SessionUser, Settings, StockMovement, StockSuggestion, Supplier, SupplierLocation, TableAdmin, TableSummary, VoidItemRequest,
} from '@mirador/shared';
import { useSession } from '@/store/session';
import { toProductModel, type ProductDTO } from './mappers';

/** Cuerpo de crear/editar producto (RF-13); el stock no va (RN-02). */
export type ProductBody = { name: string; categoryId: number; price: number; cost: number; minStock: number; imageUrl?: string | null };

/** Cuerpo de crear/editar proveedor (RF-52). */
export type SupplierBody = Omit<Supplier, 'id' | 'active'>;
/** Cuerpo de registrar compra (RF-53); el total lo calcula el servidor. */
export type PurchaseBody = { supplierId: number; date: string; items: { productId: number; qty: number; unitCost: number }[] };
/** Filtros del historial de compras (RF-55); vacío = sin filtro. */
export type PurchaseFilter = { supplierId?: number; from?: string; to?: string };

/** Rango de días locales AAAA-MM-DD, ambos incluidos (RF-57, RF-58). */
export type DateRange = { from: string; to: string };

/** Instancia central de Axios; la baseURL sale de la dirección guardada (RF-01). */
function client(): AxiosInstance {
  const { serverUrl, user } = useSession.getState();
  if (!serverUrl) throw new Error('Configura primero la dirección del servidor');
  return create({
    baseURL: serverUrl,
    timeout: 8000,
    headers: user ? { Authorization: `Bearer ${user.token}` } : undefined,
  });
}

/** Error con el mensaje del servidor y, si aplica, el campo que falló. */
export class ApiError extends Error {
  constructor(message: string, public status: number | null, public field?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

async function call<T>(fn: (c: AxiosInstance) => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn(client())).data;
  } catch (e) {
    if (e instanceof AxiosError) {
      if (!e.response) throw new ApiError('Sin conexión con el PC de caja', null);
      const body = (e.response.data ?? {}) as { error?: string; field?: string };
      if (e.response.status === 401 && useSession.getState().user) useSession.getState().signOut();
      throw new ApiError(body.error ?? 'Error del servidor', e.response.status, body.field, body as Record<string, unknown>);
    }
    throw e;
  }
}

export const api = {
  /** Prueba una dirección antes de guardarla (no usa la guardada). */
  health: async (url: string) => (await create({ timeout: 5000 }).get<HealthResponse>(`${url.replace(/\/+$/, '')}/health`)).data,
  profiles: () => call<Profile[]>((c) => c.get('/auth/profiles')),
  login: (userId: number, pin: string) => call<SessionUser>((c) => c.post('/auth/login', { userId, pin })),
  settings: () => call<Settings>((c) => c.get('/settings')),
  saveSettings: (patch: Partial<Settings>) => call<Settings>((c) => c.patch('/settings', patch)),
  users: () => call<ManagedUser[]>((c) => c.get('/users')),
  createUser: (body: { name: string; role: Role; pin: string }) => call<ManagedUser>((c) => c.post('/users', body)),
  updateUser: (id: number, body: Partial<{ name: string; role: Role; pin: string; active: boolean }>) => call<ManagedUser>((c) => c.patch(`/users/${id}`, body)),

  /** `all` (solo dueño) incluye los inactivos (RF-14). */
  products: async (all = false) => (await call<ProductDTO[]>((c) => c.get('/products', { params: all ? { all: 1 } : undefined }))).map(toProductModel),
  product: async (id: number) => toProductModel(await call<ProductDTO>((c) => c.get(`/products/${id}`))),
  movements: (id: number, type?: StockMovement['type']) => call<StockMovement[]>((c) => c.get(`/products/${id}/movements`, { params: type ? { type } : undefined })),
  adjustStock: (body: { productId: number; type: StockMovement['type']; qty: number; reason: string }) => call<StockMovement>((c) => c.post('/inventory/adjustments', body)),
  stockSuggestions: () => call<StockSuggestion[]>((c) => c.get('/inventory/suggestions')),
  createProduct: async (body: ProductBody) => toProductModel(await call<ProductDTO>((c) => c.post('/products', body))),
  updateProduct: async (id: number, body: Partial<ProductBody & { active: boolean }>) => toProductModel(await call<ProductDTO>((c) => c.patch(`/products/${id}`, body))),
  categories: () => call<Category[]>((c) => c.get('/categories')),
  createCategory: (name: string) => call<Category>((c) => c.post('/categories', { name })),
  updateCategory: (id: number, body: Partial<{ name: string; active: boolean }>) => call<Category>((c) => c.patch(`/categories/${id}`, body)),
  suppliers: () => call<Supplier[]>((c) => c.get('/suppliers')),
  supplier: (id: number) => call<Supplier>((c) => c.get(`/suppliers/${id}`)),
  supplierLocations: () => call<SupplierLocation[]>((c) => c.get('/suppliers/locations')),
  createSupplier: (body: SupplierBody) => call<Supplier>((c) => c.post('/suppliers', body)),
  updateSupplier: (id: number, body: Partial<SupplierBody & { active: boolean }>) => call<Supplier>((c) => c.patch(`/suppliers/${id}`, body)),
  purchases: (f: PurchaseFilter) => call<PurchaseListItem[]>((c) => c.get('/purchases', { params: f })),
  purchase: (id: number) => call<Purchase>((c) => c.get(`/purchases/${id}`)),
  createPurchase: (body: PurchaseBody) => call<Purchase>((c) => c.post('/purchases', body)),
  expenses: (r: DateRange) => call<Expense[]>((c) => c.get('/expenses', { params: r })),
  createExpense: (body: { concept: string; amount: number; date: string }) => call<Expense>((c) => c.post('/expenses', body)),
  summary: (r: DateRange) => call<ReportSummary>((c) => c.get('/reports/summary', { params: r })),
  tablesAdmin: () => call<TableAdmin[]>((c) => c.get('/tables/all')),
  createTable: (body: { number: number; zone?: string | null }) => call<TableAdmin>((c) => c.post('/tables', body)),
  updateTable: (id: number, body: Partial<{ zone: string | null; active: boolean }>) => call<TableAdmin>((c) => c.patch(`/tables/${id}`, body)),
  tables: () => call<TableSummary[]>((c) => c.get('/tables')),
  account: (id: number) => call<Account>((c) => c.get(`/accounts/${id}`)),
  openTable: (tableNumber: number) => call<Account>((c) => c.post('/accounts', { tableNumber })),
  createRound: (accountId: number, body: CreateRoundRequest, idempotencyKey: string) =>
    call<Account>((c) => c.post(`/accounts/${accountId}/rounds`, body, { headers: { 'Idempotency-Key': idempotencyKey } })),
  requestBill: (accountId: number) => call<Account>((c) => c.post(`/accounts/${accountId}/request-bill`)),
  reopen: (accountId: number) => call<Account>((c) => c.post(`/accounts/${accountId}/reopen`)),
  setRoundStatus: (roundId: number, status: Exclude<RoundStatus, 'tomado'>) => call<Account>((c) => c.patch(`/rounds/${roundId}/status`, { status })),
  moveAccount: (accountId: number, tableNumber: number) => call<Account>((c) => c.post(`/accounts/${accountId}/move`, { tableNumber })),
  mergeAccount: (accountId: number, intoAccountId: number) => call<Account>((c) => c.post(`/accounts/${accountId}/merge`, { intoAccountId })),
  editItem: (itemId: number, body: EditItemRequest) => call<Account>((c) => c.patch(`/rounds/items/${itemId}`, body)),
  voidItem: (itemId: number, body: VoidItemRequest) => call<Account>((c) => c.post(`/rounds/items/${itemId}/void`, body)),

  barQueue: () => call<BarTicket[]>((c) => c.get('/rounds')),
  billable: () => call<BillableAccount[]>((c) => c.get('/accounts', { params: { status: 'por_cobrar' } })),
  charge: (accountId: number, body: ChargeRequest) => call<Invoice>((c) => c.post(`/accounts/${accountId}/charge`, body)),
  invoice: (id: number) => call<Invoice>((c) => c.get(`/invoices/${id}`)),
  invoices: (q: string) => call<InvoiceListItem[]>((c) => c.get('/invoices', { params: { q } })),
  voidInvoice: (id: number, reason: string) => call<Invoice>((c) => c.post(`/invoices/${id}/void`, { reason })),
};
