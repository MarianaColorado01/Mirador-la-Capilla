import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StockMovement } from '@mirador/shared';
import { api, ApiError, type DateRange, type PurchaseFilter } from '@/services/api';
import { useLive } from '@/store/live';
import { useSession } from '@/store/session';

/** queryKey centralizados para invalidar con precisión (TanStack Query). */
export const keys = {
  health: (url: string | null) => ['health', url] as const,
  profiles: (url: string | null) => ['profiles', url] as const,
  settings: ['settings'] as const,
  // Todo lo de productos cuelga de ['products']: invalidar esa clave refresca listas, detalle y movimientos.
  products: ['products'] as const,
  productsAll: ['products', 'all'] as const,
  product: (id: number) => ['products', 'detail', id] as const,
  movements: (id: number, type?: StockMovement['type']) => ['products', 'movements', id, type ?? 'todos'] as const,
  suggestions: ['products', 'suggestions'] as const,
  categories: ['categories'] as const,
  tables: ['tables'] as const,
  tablesAdmin: ['tables', 'admin'] as const,
  account: (id: number) => ['account', id] as const,
  bar: ['bar'] as const,
  billable: ['billable'] as const,
  invoice: (id: number) => ['invoice', id] as const,
  invoices: (q: string) => ['invoices', q] as const,
  users: ['users'] as const,
  suppliers: ['suppliers'] as const,
  supplier: (id: number) => ['suppliers', id] as const,
  // Cuelga de ['suppliers']: al editar un proveedor también se refresca el mapa.
  supplierLocations: ['suppliers', 'locations'] as const,
  // Todo lo de compras cuelga de ['purchases'].
  purchases: (f: PurchaseFilter) => ['purchases', f] as const,
  purchase: (id: number) => ['purchases', 'detail', id] as const,
  expenses: (r: DateRange) => ['expenses', r] as const,
  // Todo lo del Resumen cuelga de ['reports']: invalidarla tras compras, gastos y cobros.
  reports: ['reports'] as const,
  summary: (r: DateRange) => ['reports', 'summary', r] as const,
};

// Los cambios llegan por Socket.IO (use-realtime). Esto es solo una red de seguridad
// por si se pierde un evento: un refresco lento cada 30 s.
const LIVE = 30000;

export const useTables = () => useQuery({ queryKey: keys.tables, queryFn: api.tables, refetchInterval: LIVE });
export const useAccount = (id: number) => useQuery({ queryKey: keys.account(id), queryFn: () => api.account(id), refetchInterval: LIVE, enabled: Number.isFinite(id) });
export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: () => api.products(), staleTime: 15000 });
export const useAllProducts = () => useQuery({ queryKey: keys.productsAll, queryFn: () => api.products(true) });
// Id no numérico: la consulta no corre y la pantalla muestra «Producto no encontrado» (RF-12).
export const useProduct = (id: number) => useQuery({ queryKey: keys.product(id), queryFn: () => api.product(id), enabled: Number.isInteger(id) && id > 0,
  retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status === 404) });
export const useMovements = (id: number, enabled: boolean, type?: StockMovement['type']) =>
  useQuery({ queryKey: keys.movements(id, type), queryFn: () => api.movements(id, type), enabled });
export const useStockSuggestions = () => useQuery({ queryKey: keys.suggestions, queryFn: api.stockSuggestions });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: api.categories });
export const useTablesAdmin = () => useQuery({ queryKey: keys.tablesAdmin, queryFn: api.tablesAdmin });
export const useBarQueue = () => useQuery({ queryKey: keys.bar, queryFn: api.barQueue, refetchInterval: LIVE });
export const useBillable = () => useQuery({ queryKey: keys.billable, queryFn: api.billable, refetchInterval: LIVE });
export const useInvoice = (id: number) => useQuery({ queryKey: keys.invoice(id), queryFn: () => api.invoice(id), enabled: Number.isFinite(id) });
export const useInvoices = (q: string) => useQuery({ queryKey: keys.invoices(q), queryFn: () => api.invoices(q) });
export const useSettings = (enabled = true) => useQuery({ queryKey: keys.settings, queryFn: api.settings, staleTime: 60000, enabled });
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.users });
// Un 404 no se reintenta: la pantalla muestra «no encontrado» con Volver.
const no404 = (n: number, e: Error) => n < 1 && !(e instanceof ApiError && e.status === 404);
const validId = (id: number) => Number.isInteger(id) && id > 0;
export const useSuppliers = () => useQuery({ queryKey: keys.suppliers, queryFn: api.suppliers });
export const useSupplier = (id: number) => useQuery({ queryKey: keys.supplier(id), queryFn: () => api.supplier(id), enabled: validId(id), retry: no404 });
export const useSupplierLocations = () => useQuery({ queryKey: keys.supplierLocations, queryFn: api.supplierLocations });
export const usePurchases = (f: PurchaseFilter) => useQuery({ queryKey: keys.purchases(f), queryFn: () => api.purchases(f), placeholderData: keepPreviousData });
export const useExpenses = (r: DateRange) => useQuery({ queryKey: keys.expenses(r), queryFn: () => api.expenses(r), placeholderData: keepPreviousData });
export const useSummary = (r: DateRange) => useQuery({ queryKey: keys.summary(r), queryFn: () => api.summary(r), placeholderData: keepPreviousData });
export const usePurchase = (id: number) => useQuery({ queryKey: keys.purchase(id), queryFn: () => api.purchase(id), enabled: validId(id), retry: no404 });

/**
 * RF-03: indicador de conexión con el PC de caja.
 * ok = API y tiempo real · reconnecting = la API responde pero el canal en vivo se está
 * reconectando · off = el servidor no responde (se bloquean las confirmaciones, RF-67).
 */
export function useConnection(): 'ok' | 'reconnecting' | 'off' | 'checking' {
  const url = useSession((s) => s.serverUrl);
  const loggedIn = useSession((s) => !!s.user);
  const socket = useLive((s) => s.socket);
  const q = useQuery({
    queryKey: keys.health(url),
    queryFn: () => api.health(url!),
    enabled: !!url,
    refetchInterval: 5000,
    retry: 0,
  });
  if (q.isPending) return 'checking';
  if (q.isError) return 'off';
  return loggedIn && socket !== 'connected' ? 'reconnecting' : 'ok';
}

/** Tras cualquier cambio en una cuenta, se refresca todo lo que la muestra. */
export function useInvalidateFloor() {
  const qc = useQueryClient();
  return (accountId?: number) => {
    qc.invalidateQueries({ queryKey: keys.tables });
    qc.invalidateQueries({ queryKey: keys.bar });
    qc.invalidateQueries({ queryKey: keys.billable });
    qc.invalidateQueries({ queryKey: keys.products });
    qc.invalidateQueries({ queryKey: keys.reports });
    if (accountId) qc.invalidateQueries({ queryKey: keys.account(accountId) });
  };
}

export { useMutation };
