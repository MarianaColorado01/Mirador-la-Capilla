import { useMutation } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TableStatus, TableSummary } from '@mirador/shared';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Chips, Tag } from '@/components/ui';
import { useConnection, useInvalidateFloor, useSettings, useTables } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme';
import { minutesSince, money, pad } from '@/utils/format';

type Filter = 'todas' | TableStatus;
const BAND: Record<TableStatus, { label: string; color: string }> = {
  libre: { label: 'Libre', color: colors.libre },
  ocupada: { label: 'Ocupada', color: colors.ocupada },
  por_cobrar: { label: 'Por cobrar', color: colors.porCobrar },
};

/** RF-16: mapa de mesas con su estado por color. RF-17: abrir una mesa libre. */
export default function Mesas() {
  const user = useSession((s) => s.user)!;
  const tables = useTables();
  const conn = useConnection();
  const invalidate = useInvalidateFloor();
  const [filter, setFilter] = useState<Filter>('todas');
  const canOrder = ['mesero', 'todo', 'dueno'].includes(user.role);
  const settings = useSettings();
  const singleOperator = user.role === 'todo' && !!settings.data?.singleOperator;

  const open = useMutation({
    mutationFn: (n: number) => api.openTable(n),
    onSuccess: (acc) => {
      invalidate(acc.id);
      router.push({ pathname: '/mesa/[id]/ronda', params: { id: String(acc.id) } });
    },
    onError: (e) => {
      invalidate();
      const accountId = e instanceof ApiError ? Number(e.data?.accountId) : NaN;
      Alert.alert('No se abrió la mesa', `${(e as Error).message}. No se creó una segunda cuenta.`, [
        { text: 'Cerrar', style: 'cancel' },
        ...(Number.isFinite(accountId) ? [{ text: 'Ver cuenta', onPress: () => router.push({ pathname: '/mesa/[id]', params: { id: String(accountId) } }) }] : []),
      ]);
    },
  });

  if (user.role === 'barra') return <Redirect href="/barra" />;

  const tap = (t: TableSummary) => {
    if (t.account) {
      router.push({ pathname: '/mesa/[id]', params: { id: String(t.account.id) } });
      return;
    }
    if (!canOrder) return;
    Alert.alert(`¿Abrir la mesa ${t.number}?`, `Se crea una cuenta a nombre de ${user.name}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Abrir y tomar ronda', onPress: () => open.mutate(t.number) },
    ]);
  };

  const list = tables.data ?? [];
  const count = (s: TableStatus) => list.filter((t) => t.status === s).length;
  const shown = filter === 'todas' ? list : list.filter((t) => t.status === filter);
  const ready = list.filter((t) => t.account && t.account.readyRounds > 0 && t.account.waiterId === user.id);

  return (
    <Screen refreshing={tables.isRefetching} onRefresh={() => tables.refetch()}>
      {/* RF-32: aviso cuando una ronda que tomó está lista */}
      {ready.map((t) => (
        <Pressable key={t.number} onPress={() => tap(t)}>
          <Banner tone="green" icon="bell-ring-outline" title={`Mesa ${t.number}: ronda lista en barra`} text="Toca para ir a la cuenta y marcarla entregada." />
        </Pressable>
      ))}
      {singleOperator && <Banner tone="amber" icon="information-outline" title="Modo un solo operador" text="Las rondas pasan directo a «entregada». Cobrar sigue siendo un paso aparte." />}

      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todas', label: `Todas ${list.length}` },
          { value: 'libre', label: `Libres ${count('libre')}` },
          { value: 'ocupada', label: `Ocupadas ${count('ocupada')}` },
          { value: 'por_cobrar', label: `Por cobrar ${count('por_cobrar')}` },
        ]}
      />

      {tables.isPending ? (
        <StateView kind="loading" message="Cargando mesas…" />
      ) : tables.isError && !tables.data ? (
        <StateView kind="error" message={(tables.error as Error).message} onRetry={() => tables.refetch()} />
      ) : shown.length === 0 ? (
        <StateView kind="empty" title="No hay mesas en este filtro" action={{ label: 'Ver todas', onPress: () => setFilter('todas') }} />
      ) : (
        <View style={styles.grid}>
          {shown.map((t) => (
            <Pressable
              key={t.number}
              onPress={() => tap(t)}
              disabled={open.isPending || (!t.account && (!canOrder || conn === 'off'))}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`Mesa ${t.number}, ${BAND[t.status].label}`}
            >
              <View style={styles.tileTop}>
                <Text style={styles.number}>{pad(t.number)}</Text>
                {t.account && t.account.readyRounds > 0 && <Tag label="Lista" color={colors.green} />}
              </View>
              <Text style={styles.meta} numberOfLines={2}>
                {t.account
                  ? `${t.account.waiter} · ${money(t.account.subtotal)}\n${t.status === 'por_cobrar' ? 'Pidió la cuenta' : `${minutesSince(t.account.openedAt)} min abierta`}`
                  : t.zone ?? 'Disponible'}
              </Text>
              <View style={[styles.band, { backgroundColor: BAND[t.status].color }]}>
                <Text style={styles.bandText}>{BAND[t.status].label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: '47.8%', backgroundColor: colors.face, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12, paddingBottom: 4 },
  number: { color: colors.ink, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { color: colors.ink2, fontSize: 13, paddingHorizontal: 12, paddingBottom: 12, minHeight: 46 },
  band: { height: 28, justifyContent: 'center', paddingHorizontal: 12 },
  bandText: { color: colors.onLight, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
});
