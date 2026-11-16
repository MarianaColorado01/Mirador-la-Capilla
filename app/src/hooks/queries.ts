import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useLive } from '@/store/live';
import { useSession } from '@/store/session';

/** queryKey centralizados para invalidar con precisión (TanStack Query). */
export const keys = {
  health: (url: string | null) => ['health', url] as const,
  profiles: (url: string | null) => ['profiles', url] as const,
  settings: ['settings'] as const,
  products: ['products'] as const,
  tables: ['tables'] as const,
  account: (id: number) => ['account', id] as const,
  bar: ['bar'] as const,
  billable: ['billable'] as const,
  invoice: (id: number) => ['invoice', id] as const,
  invoices: (q: string) => ['invoices', q] as const,
  users: ['users'] as const,
};

// Los cambios llegan por Socket.IO (use-realtime). Esto es solo una red de seguridad
// por si se pierde un evento: un refresco lento cada 30 s.
const LIVE = 30000;

export const useTables = () => useQuery({ queryKey: keys.tables, queryFn: api.tables, refetchInterval: LIVE });
export const useAccount = (id: number) => useQuery({ queryKey: keys.account(id), queryFn: () => api.account(id), refetchInterval: LIVE, enabled: Number.isFinite(id) });
export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: api.products, staleTime: 15000 });
export const useBarQueue = () => useQuery({ queryKey: keys.bar, queryFn: api.barQueue, refetchInterval: LIVE });
export const useBillable = () => useQuery({ queryKey: keys.billable, queryFn: api.billable, refetchInterval: LIVE });
export const useInvoice = (id: number) => useQuery({ queryKey: keys.invoice(id), queryFn: () => api.invoice(id), enabled: Number.isFinite(id) });
export const useInvoices = (q: string) => useQuery({ queryKey: keys.invoices(q), queryFn: () => api.invoices(q) });
export const useSettings = (enabled = true) => useQuery({ queryKey: keys.settings, queryFn: api.settings, staleTime: 60000, enabled });
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.users });

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
    if (accountId) qc.invalidateQueries({ queryKey: keys.account(accountId) });
  };
}

export { useMutation };
