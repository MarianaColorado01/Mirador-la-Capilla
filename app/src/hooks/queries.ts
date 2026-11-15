import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
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
};

// Mientras llega Socket.IO (fase 3), las pantallas compartidas se refrescan solas cada pocos segundos.
const LIVE = 4000;

export const useTables = () => useQuery({ queryKey: keys.tables, queryFn: api.tables, refetchInterval: LIVE });
export const useAccount = (id: number) => useQuery({ queryKey: keys.account(id), queryFn: () => api.account(id), refetchInterval: LIVE, enabled: Number.isFinite(id) });
export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: api.products, staleTime: 15000 });
export const useBarQueue = () => useQuery({ queryKey: keys.bar, queryFn: api.barQueue, refetchInterval: LIVE });
export const useBillable = () => useQuery({ queryKey: keys.billable, queryFn: api.billable, refetchInterval: LIVE });
export const useInvoice = (id: number) => useQuery({ queryKey: keys.invoice(id), queryFn: () => api.invoice(id), enabled: Number.isFinite(id) });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: api.settings, staleTime: 60000 });

/** RF-03: indicador de conexión con el PC de caja. */
export function useConnection(): 'ok' | 'off' | 'checking' {
  const url = useSession((s) => s.serverUrl);
  const q = useQuery({
    queryKey: keys.health(url),
    queryFn: () => api.health(url!),
    enabled: !!url,
    refetchInterval: 5000,
    retry: 0,
  });
  if (q.isPending) return 'checking';
  return q.isError ? 'off' : 'ok';
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
