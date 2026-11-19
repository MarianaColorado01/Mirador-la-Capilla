import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, MoneyRow } from '@/components/ui';
import { usePurchases, usePurchasesBySupplier, useSuppliers } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money, periodRange, shortDate, type Period } from '@/utils/format';

/** RF-55: historial de compras filtrable por proveedor y fecha. RF-56: total por proveedor. */
function Compras() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const suppliers = useSuppliers(true);
  const [period, setPeriod] = useState<Period>('mes');
  const [supplier, setSupplier] = useState(params.supplierId ?? 'todos');
  const range = periodRange(period);
  const filter = { ...range, ...(supplier !== 'todos' ? { supplierId: Number(supplier) } : {}) };
  const list = usePurchases(filter);
  const report = usePurchasesBySupplier(range);
  const total = (list.data ?? []).reduce((s, p) => s + p.total, 0);

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => { list.refetch(); report.refetch(); }}>
      <Chips<Period> value={period} onChange={setPeriod} options={[{ value: 'hoy', label: 'Hoy' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
      <Chips value={supplier} onChange={setSupplier} options={[{ value: 'todos', label: 'Todos' }, ...(suppliers.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} />

      <Card>
        <View style={{ padding: space.lg }}>
          <Text style={type.label}>Comprado {period === 'hoy' ? 'hoy' : period === 'semana' ? 'esta semana' : 'este mes'}</Text>
          <Text style={type.figure}>{money(total)}</Text>
          <Text style={type.small}>{list.data?.length ?? 0} compras · del {shortDate(range.from)} al {shortDate(range.to)}</Text>
        </View>
      </Card>

      {list.isPending ? (
        <StateView kind="loading" />
      ) : list.isError ? (
        <StateView kind="error" message={(list.error as Error).message} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <StateView kind="empty" icon="truck-outline" title="Sin compras en este filtro" />
      ) : (
        list.data.map((p) => (
          <Card key={p.id} title={`${shortDate(p.date)} · ${p.supplierName}`} right={<Text style={styles.total}>{money(p.total)}</Text>}>
            {p.items.map((i) => (
              <View key={i.productId} style={styles.item}>
                <Text style={[type.body, { flex: 1 }]}>{i.qty} × {i.productName}</Text>
                <Text style={type.small}>{money(i.unitCost)} c/u</Text>
                <Text style={styles.itemTotal}>{money(i.total)}</Text>
              </View>
            ))}
          </Card>
        ))
      )}

      <Card title="Total por proveedor">
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          {report.isPending ? (
            <StateView kind="loading" />
          ) : !report.data?.length ? (
            <Text style={type.small}>Sin compras en el periodo.</Text>
          ) : (
            report.data.map((r) => <MoneyRow key={r.supplierId} label={`${r.name} · ${r.purchases}`} value={r.total} />)
          )}
        </View>
      </Card>
    </Screen>
  );
}

export default function ComprasScreen() {
  return <RoleGate roles={['dueno']}><Compras /></RoleGate>;
}

const styles = StyleSheet.create({
  total: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  itemTotal: { color: colors.ink, fontWeight: '700', minWidth: 80, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
