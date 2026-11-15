import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { BarTicket, RoundStatus } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, ItemRow, RoundTag } from '@/components/ui';
import { useBarQueue, useConnection, useInvalidateFloor } from '@/hooks/queries';
import { api } from '@/services/api';
import { colors, radius, space, type } from '@/theme';
import { minutesSince, pad } from '@/utils/format';

type Tab = 'tomado' | 'preparacion' | 'listo';
const LATE = 12; // minutos: la espera se pone roja

/** Reloj que avanza cada 30 s para que el tiempo de espera se mueva solo. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** RF-31: cola de barra con mesa, mesero, tiempo, ítems y notas. RF-30: avanzar el estado. */
export default function Barra() {
  const queue = useBarQueue();
  const conn = useConnection();
  const invalidate = useInvalidateFloor();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('tomado');

  const advance = useMutation({
    mutationFn: ({ t, to }: { t: BarTicket; to: Exclude<RoundStatus, 'tomado'> }) => api.setRoundStatus(t.roundId, to),
    onSuccess: (_acc, { t, to }) => {
      invalidate(t.accountId);
      if (to === 'listo') Alert.alert('Ronda lista', `${t.takenBy} recibe el aviso en su celular.`);
    },
    onError: (e) => {
      invalidate();
      Alert.alert('No se pudo cambiar', (e as Error).message);
    },
  });

  const list = queue.data ?? [];
  const count = (s: Tab) => list.filter((t) => t.status === s).length;
  const shown = list.filter((t) => t.status === tab);

  return (
    <Screen refreshing={queue.isRefetching} onRefresh={() => queue.refetch()}>
      <Chips<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tomado', label: `Pendientes ${count('tomado')}` },
          { value: 'preparacion', label: `Preparando ${count('preparacion')}` },
          { value: 'listo', label: `Listas ${count('listo')}` },
        ]}
      />
      {queue.isPending ? (
        <StateView kind="loading" message="Cargando comandas…" />
      ) : queue.isError && !queue.data ? (
        <StateView kind="error" message={(queue.error as Error).message} onRetry={() => queue.refetch()} />
      ) : shown.length === 0 ? (
        <StateView kind="empty" icon="glass-cocktail" title="Nada por aquí" message="Las rondas nuevas aparecen solas, sin recargar." />
      ) : (
        shown.map((t) => {
          const m = minutesSince(t.createdAt, now);
          const barColor = m >= LATE ? colors.red : m > 6 ? colors.amber : colors.ink2;
          return (
            <Card key={t.roundId} title={`Mesa ${pad(t.tableNumber)} · ${t.takenBy} · Ronda ${t.roundNumber}`} right={<RoundTag status={t.status} />}>
              <View style={styles.wait}>
                <View style={styles.waitHead}>
                  <Text style={type.label}>Espera</Text>
                  <Text style={[styles.mins, { color: m >= LATE ? colors.red : colors.ink }]}>{pad(m)} min</Text>
                </View>
                {/* La longitud de la barra es la espera real (0–20 min) */}
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.min(m / 20, 1) * 100}%`, backgroundColor: barColor }]} />
                </View>
              </View>
              {t.items.map((i) => (
                <ItemRow key={i.id} item={i} showPrice={false} />
              ))}
              <View style={{ padding: space.md }}>
                {t.status === 'tomado' && (
                  <AppButton label="Preparar" icon="play" variant="outline" disabled={conn === 'off'} loading={advance.isPending && advance.variables?.t.roundId === t.roundId} onPress={() => advance.mutate({ t, to: 'preparacion' })} />
                )}
                {t.status === 'preparacion' && (
                  <AppButton label="Marcar lista" icon="check" disabled={conn === 'off'} loading={advance.isPending && advance.variables?.t.roundId === t.roundId} onPress={() => advance.mutate({ t, to: 'listo' })} />
                )}
                {t.status === 'listo' && <Text style={type.small}>Esperando a que {t.takenBy} la entregue.</Text>}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wait: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: 6 },
  waitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  mins: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: radius.sm, backgroundColor: colors.line2, overflow: 'hidden' },
  fill: { height: '100%' },
});
