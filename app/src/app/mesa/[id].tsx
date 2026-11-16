import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Account, Round, RoundItem } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, ItemRow, RoundTag, Tag } from '@/components/ui';
import { VoidItemSheet } from '@/components/VoidItemSheet';
import { keys, useAccount, useConnection, useInvalidateFloor } from '@/hooks/queries';
import { api } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, space, type } from '@/theme';
import { clock, money, pad } from '@/utils/format';

/** RF-18: la cuenta de la mesa con sus rondas. RF-19, RF-21, RF-28, RF-30, RF-33 a RF-36. */
export default function MesaCuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const role = useSession((s) => s.user!.role);
  const account = useAccount(accountId);
  const conn = useConnection();
  const invalidate = useInvalidateFloor();
  const qc = useQueryClient();
  const [voiding, setVoiding] = useState<{ item: RoundItem; round: Round } | null>(null);

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

      <VoidItemSheet
        key={voiding?.item.id ?? 'cerrada'}
        item={voiding?.item ?? null}
        roundStatus={voiding?.round.status ?? 'tomado'}
        role={role}
        busy={act.isPending}
        offline={conn === 'off'}
        onClose={() => setVoiding(null)}
        onConfirm={(reason, restock) =>
          act.mutate(() => api.voidItem(voiding!.item.id, { reason, restock }), { onSuccess: () => setVoiding(null) })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
