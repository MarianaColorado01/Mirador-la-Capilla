import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, MoneyRow } from '@/components/ui';
import { usePurchase } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';
import { dateTime, money } from '@/utils/format';

/** RF-55: detalle de una compra con ítems, costos, total y quién la registró. ?fresh=1 tras guardarla. */
export default function Compra() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const purchase = usePurchase(Number(id));
  const notFound = !(Number(id) > 0) || (purchase.error instanceof ApiError && purchase.error.status === 404);

  if (notFound)
    return <Screen><StateView kind="empty" icon="cart-outline" title="Compra no encontrada" action={{ label: 'Volver', onPress: () => router.back() }} /></Screen>;
  if (purchase.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (purchase.isError) return <Screen><StateView kind="error" message={purchase.error.message} onRetry={() => purchase.refetch()} /></Screen>;

  const p = purchase.data;
  return (
    <Screen footer={fresh ? <AppButton label="Listo" icon="check" onPress={() => router.back()} /> : undefined}>
      <Stack.Screen options={{ title: `Compra ${p.id}` }} />
      {fresh && <Banner tone="green" icon="check-circle-outline" title="Compra guardada" text="El stock y el último costo de cada producto ya están actualizados." />}
      <Card title={p.supplierName}>
        <View style={styles.block}>
          <MoneyRow label="Fecha de la compra" value={p.date} />
          <MoneyRow label="Registró" value={`${p.user} · ${dateTime(p.createdAt)}`} />
        </View>
        {p.items.map((i) => (
          <View key={i.id} style={styles.item} accessible accessibilityLabel={`${i.name}: ${i.qty} a ${money(i.unitCost)}, total ${money(i.total)}`}>
            <Text style={styles.qty}>{i.qty}×</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{i.name}</Text>
              <Text style={type.small}>{money(i.unitCost)} c/u</Text>
            </View>
            <Text style={styles.total}>{money(i.total)}</Text>
          </View>
        ))}
        <View style={styles.block}>
          <MoneyRow label="Total" value={p.total} strong />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, minHeight: 56, borderTopWidth: 1, borderTopColor: colors.line2 },
  qty: { color: colors.ink2, fontSize: 16, fontWeight: '800', minWidth: 36, fontVariant: ['tabular-nums'] },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  total: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
