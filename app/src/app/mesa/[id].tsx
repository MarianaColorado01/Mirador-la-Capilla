import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Account, Round, RoundItem } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, ItemRow, RoundTag, Tag } from '@/components/ui';
import { VoidItemSheet } from '@/components/VoidItemSheet';
import { keys, useAccount, useConnection, useInvalidateFloor, useProducts, useTables } from '@/hooks/queries';
import { api, type ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';
import { clock, money, pad } from '@/utils/format';

/** RF-18: la cuenta de la mesa con sus rondas. RF-19 a RF-21, RF-28, RF-30, RF-33 a RF-36. */
export default function MesaCuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const role = useSession((s) => s.user!.role);
  const account = useAccount(accountId);
  const conn = useConnection();
  const invalidate = useInvalidateFloor();
  const qc = useQueryClient();
  const [voiding, setVoiding] = useState<{ item: RoundItem; round: Round } | null>(null);
  const [picker, setPicker] = useState<'move' | 'merge' | null>(null);
  const products = useProducts();

  const act = useMutation({
    mutationFn: (fn: () => Promise<Account>) => fn(),
    onSuccess: (acc) => {
      // La respuesta ya trae la cuenta al día: se pinta sin esperar la recarga.
      qc.setQueryData(keys.account(accountId), acc);
      invalidate(accountId);
    },
    onError: (e) => {
      invalidate(accountId);
      Alert.alert('No se pudo completar', (e as Error).message);
    },
  });

  // RF-33: el error se muestra dentro de la hoja, bajo el campo que falló.
  const edit = useMutation<Account, ApiError, { itemId: number; qty: number; note: string | null }>({
    mutationFn: ({ itemId, qty, note }) => api.editItem(itemId, { qty, note }),
    onSuccess: (acc) => {
      qc.setQueryData(keys.account(accountId), acc);
      invalidate(accountId);
      setVoiding(null);
    },
    onError: () => invalidate(accountId),
  });

  if (account.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (account.isError && !account.data) {
    const notFound = (account.error as Error).message === 'Cuenta no encontrada';
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Mesa' }} />
        {notFound ? (
          <StateView kind="empty" icon="table-off" title="Cuenta no encontrada" message="Puede que ya se haya pagado." action={{ label: 'Volver a mesas', onPress: () => router.back() }} />
        ) : (
          <StateView kind="error" message={(account.error as Error).message} onRetry={() => account.refetch()} />
        )}
      </Screen>
    );
  }

  const a = account.data;
  const off = conn === 'off' || act.isPending;
  const canOrder = ['mesero', 'todo', 'dueno'].includes(role);
  const canCharge = ['caja', 'todo', 'dueno'].includes(role);
  const statusTag = a.status === 'abierta' ? { l: 'Ocupada', c: colors.ocupada } : a.status === 'por_cobrar' ? { l: 'Por cobrar', c: colors.porCobrar } : { l: 'Pagada', c: colors.ink3 };

  const footer =
    a.status === 'pagada' ? (
      a.invoiceId && canCharge ? <AppButton label="Ver factura" icon="receipt" onPress={() => router.replace({ pathname: '/factura/[id]', params: { id: String(a.invoiceId) } })} /> : null
    ) : a.status === 'por_cobrar' ? (
      canCharge ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppButton label="Reabrir" icon="undo" variant="outline" disabled={off} onPress={() => act.mutate(() => api.reopen(accountId))} />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton label="Cobrar" icon="cash" onPress={() => router.push({ pathname: '/cobro/[id]', params: { id: String(accountId) } })} />
          </View>
        </View>
      ) : (
        <Text style={[type.small, { textAlign: 'center' }]}>La cuenta está en caja. No admite rondas hasta que caja la reabra.</Text>
      )
    ) : (
      <>
        {canOrder && <AppButton label="Agregar ronda" icon="plus" onPress={() => router.push({ pathname: '/mesa/[id]/ronda', params: { id: String(accountId) } })} />}
        {role === 'todo' ? (
          <AppButton
            label="Cobrar ahora"
            icon="cash"
            variant="outline"
            disabled={off || a.subtotal <= 0}
            onPress={() => act.mutate(() => api.requestBill(accountId), { onSuccess: () => router.push({ pathname: '/cobro/[id]', params: { id: String(accountId) } }) })}
          />
        ) : (
          <AppButton label="Pedir la cuenta" icon="receipt" variant="outline" disabled={off || a.subtotal <= 0} onPress={() => act.mutate(() => api.requestBill(accountId))} />
        )}
      </>
    );

  const stockOf = (pid: number) => products.data?.find((p) => p.id === pid)?.stock ?? 0;

  return (
    <Screen footer={footer} refreshing={account.isRefetching} onRefresh={() => account.refetch()}>
      <Stack.Screen options={{ title: `Mesa ${pad(a.tableNumber)}` }} />
      <Card>
        <View style={styles.total}>
          <View>
            <Text style={type.label}>Total acumulado</Text>
            <Text style={type.figure}>{money(a.subtotal)}</Text>
            <Text style={type.small}>Abierta por {a.waiter} · {clock(a.openedAt)}</Text>
          </View>
          <Tag label={statusTag.l} color={statusTag.c} />
        </View>
      </Card>

      {a.mergedInto && (
        <>
          <Banner tone="neutral" icon="call-merge" title="Esta cuenta se unió a otra mesa" text="Sus rondas ahora están en la otra cuenta." />
          <AppButton label="Ir a la cuenta unida" icon="arrow-right" variant="outline" onPress={() => router.replace({ pathname: '/mesa/[id]', params: { id: String(a.mergedInto) } })} />
        </>
      )}

      {a.rounds.length === 0 ? (
        <StateView kind="empty" icon="note-text-outline" title="Aún no hay rondas" message="Agrega la primera ronda de esta mesa." />
      ) : (
        [...a.rounds].reverse().map((r) => (
          <Card key={r.id} title={`Ronda ${r.number} · ${clock(r.createdAt)} · ${r.takenBy}`} right={<RoundTag status={r.status} />}>
            {r.items.map((i) => (
              <ItemRow key={i.id} item={i} onVoid={a.status !== 'pagada' && role !== 'barra' ? () => setVoiding({ item: i, round: r }) : undefined} />
            ))}
            {r.status === 'listo' && canOrder && (
              <View style={{ padding: space.md }}>
                <AppButton label="Marcar entregada" icon="check" variant="outline" compact disabled={off} onPress={() => act.mutate(() => api.setRoundStatus(r.id, 'entregado'))} />
              </View>
            )}
          </Card>
        ))
      )}
      <Text style={type.small}>Los ítems anulados no suman al total.</Text>

      {/* RF-20: solo caja, todo en uno y dueño mueven o unen cuentas */}
      {canCharge && a.status !== 'pagada' && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppButton label="Mover de mesa" icon="swap-horizontal" variant="outline" compact disabled={off} onPress={() => setPicker('move')} />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton label="Unir cuentas" icon="call-merge" variant="outline" compact disabled={off} onPress={() => setPicker('merge')} />
          </View>
        </View>
      )}
      {picker && (
        <TablePicker
          mode={picker}
          account={a}
          busy={act.isPending}
          onClose={() => setPicker(null)}
          onPick={(tableNumber, intoAccountId) =>
            picker === 'move'
              ? act.mutate(() => api.moveAccount(accountId, tableNumber), { onSuccess: () => setPicker(null) })
              : act.mutate(() => api.mergeAccount(accountId, intoAccountId!), {
                  onSuccess: (acc) => {
                    setPicker(null);
                    router.replace({ pathname: '/mesa/[id]', params: { id: String(acc.id) } });
                  },
                })
          }
        />
      )}

      <VoidItemSheet
        key={voiding?.item.id ?? 'cerrada'}
        item={voiding?.item ?? null}
        roundStatus={voiding?.round.status ?? 'tomado'}
        role={role}
        busy={act.isPending || edit.isPending}
        offline={conn === 'off'}
        maxQty={voiding ? stockOf(voiding.item.productId) + voiding.item.qty : undefined}
        onSave={a.status === 'abierta' ? (qty, note) => edit.mutate({ itemId: voiding!.item.id, qty, note }) : undefined}
        saveError={edit.error}
        onClose={() => {
          edit.reset();
          setVoiding(null);
        }}
        onConfirm={(reason, restock) =>
          act.mutate(() => api.voidItem(voiding!.item.id, { reason, restock }), { onSuccess: () => setVoiding(null) })
        }
      />
    </Screen>
  );
}

/** Hoja para elegir la mesa destino (mover a una libre) o la cuenta a la que se une (RF-20). */
function TablePicker({ mode, account, busy, onClose, onPick }: {
  mode: 'move' | 'merge';
  account: Account;
  busy: boolean;
  onClose: () => void;
  onPick: (tableNumber: number, intoAccountId?: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const tables = useTables();
  const conn = useConnection();
  const list = (tables.data ?? []).filter((t) => (mode === 'move' ? t.status === 'libre' : !!t.account && t.account.id !== account.id));
  const off = busy || conn === 'off';
  const confirm = (n: number, intoId?: number) =>
    Alert.alert(
      mode === 'move' ? `¿Mover a la mesa ${pad(n)}?` : `¿Unir con la mesa ${pad(n)}?`,
      mode === 'move'
        ? `La mesa ${pad(account.tableNumber)} quedará libre.`
        : `Las rondas de la mesa ${pad(account.tableNumber)} pasan a la mesa ${pad(n)} y esta queda libre. No se puede deshacer.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: mode === 'move' ? 'Mover' : 'Unir', onPress: () => onPick(n, intoId) }],
    );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
        <Text style={type.h}>{mode === 'move' ? 'Mover a una mesa libre' : 'Unir con otra cuenta'}</Text>
        <Text style={type.small}>
          {mode === 'move' ? 'La cuenta conserva sus rondas y su mesero.' : `Las rondas de la mesa ${pad(account.tableNumber)} se suman a la cuenta que elijas.`}
        </Text>
        {tables.isPending ? (
          <StateView kind="loading" />
        ) : tables.isError && !tables.data ? (
          <StateView kind="error" message={(tables.error as Error).message} onRetry={() => tables.refetch()} />
        ) : list.length === 0 ? (
          <StateView kind="empty" icon="table-off" title={mode === 'move' ? 'No hay mesas libres' : 'No hay otras mesas ocupadas'} />
        ) : (
          <View style={styles.grid}>
            {list.map((t) => (
              <Pressable
                key={t.number}
                style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.face2 }, off && { opacity: 0.5 }]}
                disabled={off}
                onPress={() => confirm(t.number, t.account?.id)}
                accessibilityRole="button"
                accessibilityLabel={`Mesa ${t.number}${t.account ? `, ${t.account.waiter}, ${money(t.account.subtotal)}` : ''}`}
              >
                <Text style={styles.cellNum}>{pad(t.number)}</Text>
                <Text style={type.small}>{t.account ? `${t.account.waiter} · ${money(t.account.subtotal)}` : (t.zone ?? 'Libre')}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <AppButton label="Cancelar" variant="text" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31%', minHeight: 64, padding: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, justifyContent: 'center' },
  cellNum: { color: colors.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
