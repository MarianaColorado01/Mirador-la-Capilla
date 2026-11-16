import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SessionUser } from '@mirador/shared';
import { useRoundDrafts } from './round-drafts';

interface SessionState {
  /** Dirección del servidor del local (RF-01, RF-02). */
  serverUrl: string | null;
  user: SessionUser | null;
  hydrated: boolean;
  setServerUrl: (url: string | null) => void;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      serverUrl: null,
      user: null,
      hydrated: false,
      setServerUrl: (serverUrl) => {
        if (serverUrl) useRoundDrafts.getState().bindServer(serverUrl);
        set({ serverUrl, user: null });
      },
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    {
      name: 'mirador-sesion',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ serverUrl, user }) => ({ serverUrl, user }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
