import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Vibration } from 'react-native';
import { io } from 'socket.io-client';
import type { ServerEvents } from '@mirador/shared';
import { useLive } from '@/store/live';
import { useRoundDrafts } from '@/store/round-drafts';
import { useSession } from '@/store/session';
import { keys } from './queries';

/**
 * Canal en tiempo real (RF-70). Cada evento invalida las consultas que muestra
 * el dato afectado: la app siempre vuelve a leer del servidor y nunca aplica a
 * mano lo que trae el evento. Al reconectar se refresca todo (RF-67).
 */
export function useRealtime() {
  const qc = useQueryClient();
  const serverUrl = useSession((s) => s.serverUrl);
  const user = useSession((s) => s.user);
  const token = user?.token;
  const myId = user?.id;
  const role = user?.role;

  useEffect(() => {
    if (!serverUrl || !token) return;
    const { setSocket, notify } = useLive.getState();
    setSocket('connecting');

    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const floor = (accountId?: number) => {
      qc.invalidateQueries({ queryKey: keys.tables });
      qc.invalidateQueries({ queryKey: keys.bar });
      qc.invalidateQueries({ queryKey: keys.billable });
      if (accountId) qc.invalidateQueries({ queryKey: keys.account(accountId) });
    };

    socket.on('connect', () => {
      setSocket('connected');
      // Reintento al reconectar: lo que cambió mientras no había conexión se vuelve a leer.
      qc.invalidateQueries();
    });
    socket.on('disconnect', () => setSocket('reconnecting'));
    socket.on('connect_error', (err) => {
      setSocket('reconnecting');
      // Token vencido o de otra base: volver al login.
      if (err.message === 'No autorizado') useSession.getState().signOut();
    });

    socket.on('ronda:creada', (e: ServerEvents['ronda:creada']) => {
      floor(e.accountId);
      qc.invalidateQueries({ queryKey: keys.products });
    });
    socket.on('ronda:estado', (e: ServerEvents['ronda:estado']) => {
      floor(e.accountId);
      // RF-32: aviso al mesero que tomó la ronda.
      if (e.status === 'listo' && e.takenById === myId) {
        Vibration.vibrate([0, 250, 120, 250]);
        notify({ tone: 'green', icon: 'bell-ring-outline', title: 'Ronda lista en barra', text: 'Toca para ir a la cuenta y entregarla.', accountId: e.accountId });
      }
    });
    socket.on('item:anulado', (e: ServerEvents['item:anulado']) => {
      floor(e.accountId);
      qc.invalidateQueries({ queryKey: keys.products });
      if (role === 'barra' || role === 'todo') notify({ tone: 'red', icon: 'close-circle-outline', title: 'Se anuló un ítem', text: 'En la comanda aparece tachado.' });
    });
    socket.on('item:editado', (e: ServerEvents['item:editado']) => {
      floor(e.accountId);
      qc.invalidateQueries({ queryKey: keys.products });
    });
    socket.on('mesa:actualizada', (e: ServerEvents['mesa:actualizada']) => floor(e.accountId));
    socket.on('stock:bajo', (e: ServerEvents['stock:bajo']) => {
      qc.invalidateQueries({ queryKey: keys.products });
      notify({ tone: 'amber', icon: 'alert-outline', title: `Stock bajo: ${e.name}`, text: `Quedan ${e.stock} (mínimo ${e.minStock}).` });
    });
    socket.on('datos:restaurados', () => {
      // RF-71: todo volvió a otra fecha. Los borradores apuntan a cuentas que pueden ya no ser las mismas.
      useRoundDrafts.setState({ drafts: {} });
      qc.invalidateQueries();
      notify({ tone: 'amber', icon: 'backup-restore', title: 'Se restauró una copia', text: 'Los datos volvieron a esa fecha. Revisa las mesas antes de seguir.' });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [serverUrl, token, myId, role, qc]);
}
