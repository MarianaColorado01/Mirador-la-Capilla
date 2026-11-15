import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '@mirador/shared';

export interface DraftItem {
  productId: number;
  name: string;
  price: number;
  stock: number;
  qty: number;
  note: string;
}

export interface Draft {
  /** Clave de idempotencia: la misma mientras el borrador exista (RF-27). */
  key: string;
  items: DraftItem[];
  updatedAt: number;
}

interface DraftState {
  drafts: Record<string, Draft>;
  add: (accountId: number, p: Product) => void;
  setQty: (accountId: number, productId: number, qty: number) => void;
  setNote: (accountId: number, productId: number, note: string) => void;
  remove: (accountId: number, productId: number) => void;
  discard: (accountId: number) => void;
}

const empty = (): Draft => ({ key: Crypto.randomUUID(), items: [], updatedAt: Date.now() });

/** Ronda en construcción, guardada en el celular aunque se cierre la app o caiga el Wi-Fi (RF-26). */
export const useRoundDrafts = create<DraftState>()(
  persist(
    (set) => {
      const edit = (accountId: number, fn: (d: Draft) => Draft) =>
        set((s) => {
          const id = String(accountId);
          return { drafts: { ...s.drafts, [id]: { ...fn(s.drafts[id] ?? empty()), updatedAt: Date.now() } } };
        });
      return {
        drafts: {},
        add: (accountId, p) =>
          edit(accountId, (d) => {
            const found = d.items.find((i) => i.productId === p.id);
            if (found) {
              return { ...d, items: d.items.map((i) => (i.productId === p.id ? { ...i, stock: p.stock, qty: Math.min(i.qty + 1, p.stock) } : i)) };
            }
            return { ...d, items: [...d.items, { productId: p.id, name: p.name, price: p.price, stock: p.stock, qty: 1, note: '' }] };
          }),
        setQty: (accountId, productId, qty) =>
          edit(accountId, (d) => ({ ...d, items: d.items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i)) })),
        setNote: (accountId, productId, note) =>
          edit(accountId, (d) => ({ ...d, items: d.items.map((i) => (i.productId === productId ? { ...i, note: note.slice(0, 100) } : i)) })),
        remove: (accountId, productId) => edit(accountId, (d) => ({ ...d, items: d.items.filter((i) => i.productId !== productId) })),
        discard: (accountId) =>
          set((s) => {
            const next = { ...s.drafts };
            delete next[String(accountId)];
            return { drafts: next };
          }),
      };
    },
    { name: 'mirador-rondas', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
