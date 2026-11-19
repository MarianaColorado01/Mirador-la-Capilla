import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card } from '@/components/ui';
import { useBillable } from '@/hooks/queries';
import { colors, tabular, text } from '@/theme';
import { clock, money, pad } from '@/utils/format';

/** RF-38: cuentas por cobrar. */
export default function Caja() {
  const billable = useBillable();
  const list = billable.data ?? [];
  const sum = list.reduce((s, a) => s + a.subtotal, 0);

  return (
    <Screen refreshing={billable.isRefetching} onRefresh={() => billable.refetch()}>
      <Card>
        <View className="p-lg">
          <Text className={text.label}>Por cobrar · {list.length} {list.length === 1 ? 'mesa' : 'mesas'}</Text>
          <Text className={text.figure} style={tabular}>{money(sum)}</Text>
          <Text className={text.small}>Subtotal sin propina ni impuesto</Text>
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
              className="flex-row items-center gap-md px-[14px] min-h-[64px] border-t border-t-line2 active:bg-face2"
              onPress={() => router.push({ pathname: '/cobro/[id]', params: { id: String(a.id) } })}
              accessibilityRole="button"
            >
              <Text className="font-display text-[24px] text-porCobrar min-w-[36px]" style={tabular}>{pad(a.tableNumber)}</Text>
              <View className="flex-1">
                <Text className="font-body-semi text-[15px] text-ink">{a.waiter}</Text>
                <Text className={text.small}>
                  {a.rounds} {a.rounds === 1 ? 'ronda' : 'rondas'} · desde {clock(a.openedAt)}
                  {a.voidedItems ? ` · ${a.voidedItems} anulado${a.voidedItems === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              <Text className="font-display text-[17px] text-ink" style={tabular}>{money(a.subtotal)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
