import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card } from '@/components/ui';
import { useBillable } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { clock, money, pad } from '@/utils/format';

/** RF-38: cuentas por cobrar. */
export default function Caja() {
  const billable = useBillable();
  const list = billable.data ?? [];
  const sum = list.reduce((s, a) => s + a.subtotal, 0);

  return (
    <Screen refreshing={billable.isRefetching} onRefresh={() => billable.refetch()}>
      <Card>
        <View style={{ padding: space.lg }}>
          <Text style={type.label}>Por cobrar · {list.length} {list.length === 1 ? 'mesa' : 'mesas'}</Text>
          <Text style={type.figure}>{money(sum)}</Text>
          <Text style={type.small}>Subtotal sin propina ni impuesto</Text>
        </View>
      </Card>
      {/* RF-43: también está en el menú lateral */}
      <AppButton label="Historial de facturas" icon="receipt" variant="outline" compact onPress={() => router.push('/facturas')} />
      {billable.isPending ? (
        <StateView kind="loading" />
      ) : billable.isError && !billable.data ? (
        <StateView kind="error" message={(billable.error as Error).message} onRetry={() => billable.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="cash-check" title="No hay cuentas por cobrar" message="Cuando un mesero pida la cuenta, la mesa aparece aquí." />
      ) : (
        <Card title="Mesa · subtotal">
          {list.map((a) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push({ pathname: '/cobro/[id]', params: { id: String(a.id) } })}
              accessibilityRole="button"
            >
              <Text style={styles.table}>{pad(a.tableNumber)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{a.waiter}</Text>
                <Text style={type.small}>
                  {a.rounds} {a.rounds === 1 ? 'ronda' : 'rondas'} · desde {clock(a.openedAt)}
                  {a.voidedItems ? ` · ${a.voidedItems} anulado${a.voidedItems === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              <Text style={styles.amount}>{money(a.subtotal)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  table: { color: colors.porCobrar, fontSize: 24, fontWeight: '800', minWidth: 36, fontVariant: ['tabular-nums'] },
  amount: { color: colors.ink, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] },
});
