import { AxiosError, create, type AxiosInstance } from 'axios';
import type {
  Account, BarTicket, BillableAccount, ChargeRequest, CreateRoundRequest, HealthResponse, Invoice, Product, Profile,
  RoundStatus, SessionUser, Settings, TableSummary, VoidItemRequest,
} from '@mirador/shared';
import { useSession } from '@/store/session';

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
};
