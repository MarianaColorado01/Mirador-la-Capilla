import { AxiosError, create, type AxiosInstance } from 'axios';
import type {
  Account, AdjustmentInput, BarTicket, BillableAccount, Category, CategoryInput, ChargeRequest, CreateRoundRequest, Expense, ExpenseInput,
  HealthResponse, Invoice, Product, ProductInput, ProductOwnerView, Profile, Purchase, PurchaseInput, PurchasesBySupplier, RestockSuggestion,
  RoundStatus, SessionUser, Settings, StockMovement, SummaryReport, Supplier, SupplierInput, TableSummary, VoidItemRequest,
} from '@mirador/shared';
import { useSession } from '@/store/session';

export type InventoryItem = ProductOwnerView & { low: boolean };
export interface InvoiceRow { id: number; number: number; total: number; createdAt: string; voided: boolean; tableNumber: number; method: string }
type Range = { from?: string; to?: string };

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

  products: () => call<Product[]>((c) => c.get('/products')),
  tables: () => call<TableSummary[]>((c) => c.get('/tables')),
  account: (id: number) => call<Account>((c) => c.get(`/accounts/${id}`)),
  openTable: (tableNumber: number) => call<Account>((c) => c.post('/accounts', { tableNumber })),
  createRound: (accountId: number, body: CreateRoundRequest, idempotencyKey: string) =>
    call<Account>((c) => c.post(`/accounts/${accountId}/rounds`, body, { headers: { 'Idempotency-Key': idempotencyKey } })),
  requestBill: (accountId: number) => call<Account>((c) => c.post(`/accounts/${accountId}/request-bill`)),
  reopen: (accountId: number) => call<Account>((c) => c.post(`/accounts/${accountId}/reopen`)),
  setRoundStatus: (roundId: number, status: Exclude<RoundStatus, 'tomado'>) => call<Account>((c) => c.patch(`/rounds/${roundId}/status`, { status })),
  voidItem: (itemId: number, body: VoidItemRequest) => call<Account>((c) => c.post(`/rounds/items/${itemId}/void`, body)),

  barQueue: () => call<BarTicket[]>((c) => c.get('/rounds')),
  billable: () => call<BillableAccount[]>((c) => c.get('/accounts', { params: { status: 'por_cobrar' } })),
  charge: (accountId: number, body: ChargeRequest) => call<Invoice>((c) => c.post(`/accounts/${accountId}/charge`, body)),
  invoice: (id: number) => call<Invoice>((c) => c.get(`/invoices/${id}`)),
  invoices: (q: string) => call<InvoiceRow[]>((c) => c.get('/invoices', { params: { q } })),

  // Fase 4: productos, inventario, surtido, gastos y resumen
  product: (id: number) => call<Product | ProductOwnerView>((c) => c.get(`/products/${id}`)),
  allProducts: () => call<ProductOwnerView[]>((c) => c.get('/products', { params: { all: '1' } })),
  movements: (id: number) => call<StockMovement[]>((c) => c.get(`/products/${id}/movements`)),
  createProduct: (body: ProductInput) => call<ProductOwnerView>((c) => c.post('/products', body)),
  updateProduct: (id: number, body: Partial<ProductInput>) => call<ProductOwnerView>((c) => c.patch(`/products/${id}`, body)),
  categories: () => call<Category[]>((c) => c.get('/categories')),
  createCategory: (body: CategoryInput) => call<Category>((c) => c.post('/categories', body)),
  updateCategory: (id: number, body: Partial<CategoryInput>) => call<Category>((c) => c.patch(`/categories/${id}`, body)),
  inventory: () => call<InventoryItem[]>((c) => c.get('/inventory')),
  adjust: (body: AdjustmentInput) => call<{ productId: number; stock: number; delta: number }>((c) => c.post('/inventory/adjustments', body)),
  suggestions: () => call<RestockSuggestion[]>((c) => c.get('/inventory/suggestions')),
  suppliers: (all = false) => call<Supplier[]>((c) => c.get('/suppliers', { params: all ? { all: '1' } : undefined })),
  supplier: (id: number) => call<Supplier>((c) => c.get(`/suppliers/${id}`)),
  createSupplier: (body: SupplierInput) => call<Supplier>((c) => c.post('/suppliers', body)),
  updateSupplier: (id: number, body: Partial<SupplierInput>) => call<Supplier>((c) => c.patch(`/suppliers/${id}`, body)),
  purchases: (params: Range & { supplierId?: number }) => call<Purchase[]>((c) => c.get('/purchases', { params })),
  purchasesBySupplier: (params: Range) => call<PurchasesBySupplier[]>((c) => c.get('/purchases/by-supplier', { params })),
  createPurchase: (body: PurchaseInput) => call<Purchase>((c) => c.post('/purchases', body)),
  expenses: (params: Range) => call<Expense[]>((c) => c.get('/expenses', { params })),
  createExpense: (body: ExpenseInput) => call<Expense>((c) => c.post('/expenses', body)),
  summary: (params: { from: string; to: string }) => call<SummaryReport>((c) => c.get('/reports/summary', { params })),
};
