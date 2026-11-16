import { AxiosError, create, type AxiosInstance } from 'axios';
import type {
  Account, BarTicket, BillableAccount, Category, ChargeRequest, CreateRoundRequest, EditItemRequest, HealthResponse, Invoice, InvoiceListItem, ManagedUser, Profile,
  Role, RoundStatus, SessionUser, Settings, StockMovement, TableAdmin, TableSummary, VoidItemRequest,
} from '@mirador/shared';
import { useSession } from '@/store/session';
import { toProductModel, type ProductDTO } from './mappers';

/** Cuerpo de crear/editar producto (RF-13); el stock no va (RN-02). */
export type ProductBody = { name: string; categoryId: number; price: number; cost: number; minStock: number; imageUrl?: string | null };

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
  movements: (id: number) => call<StockMovement[]>((c) => c.get(`/products/${id}/movements`)),
  createProduct: async (body: ProductBody) => toProductModel(await call<ProductDTO>((c) => c.post('/products', body))),
  updateProduct: async (id: number, body: Partial<ProductBody & { active: boolean }>) => toProductModel(await call<ProductDTO>((c) => c.patch(`/products/${id}`, body))),
  categories: () => call<Category[]>((c) => c.get('/categories')),
  createCategory: (name: string) => call<Category>((c) => c.post('/categories', { name })),
  updateCategory: (id: number, body: Partial<{ name: string; active: boolean }>) => call<Category>((c) => c.patch(`/categories/${id}`, body)),
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
