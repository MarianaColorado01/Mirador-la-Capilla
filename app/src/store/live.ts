import { create } from 'zustand';

export type SocketState = 'connecting' | 'connected' | 'reconnecting';

export interface Notice {
  id: number;
  tone: 'green' | 'amber' | 'red';
  icon: 'bell-ring-outline' | 'alert-outline' | 'wifi' | 'close-circle-outline' | 'backup-restore';
  title: string;
  text?: string;
  /** Cuenta a abrir al tocar el aviso. */
  accountId?: number;
}

interface LiveState {
  socket: SocketState;
  notices: Notice[];
  setSocket: (s: SocketState) => void;
  notify: (n: Omit<Notice, 'id'>) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

/** Estado del canal en tiempo real y avisos que llegan por él (RF-03, RF-32, RF-50). */
export const useLive = create<LiveState>()((set) => ({
  socket: 'connecting',
  notices: [],
  setSocket: (socket) => set({ socket }),
  notify: (n) => set((s) => ({ notices: [...s.notices.slice(-2), { ...n, id: ++seq }] })),
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
