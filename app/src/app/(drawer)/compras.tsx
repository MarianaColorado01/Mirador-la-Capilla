import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isDate } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Field } from '@/components/ui';
import { usePurchases, useSuppliers } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money } from '@/utils/format';

const dateError = (v: string) => (v === '' || isDate(v) ? undefined : 'Escribe la fecha como AAAA-MM-DD');

/** RF-55: historial de compras filtrable por proveedor y rango de fechas (dueño). ?supplierId= llega desde el proveedor. */
export default function Compras() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const suppliers = useSuppliers();
  const [supplier, setSupplier] = useState(params.supplierId ?? 'todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // El Drawer conserva la pantalla montada: si se vuelve a abrir desde otro proveedor, se toma el nuevo filtro.
  const [seen, setSeen] = useState(params.supplierId);
  if (params.supplierId !== seen) {
    setSeen(params.supplierId);
    if (params.supplierId) setSupplier(params.supplierId);
  }

  const fromErr = dateError(from);
  const toErr = dateError(to) ?? (from && to && !fromErr && to < from ? 'La fecha final no puede ser anterior a la inicial' : undefined);
  // Una fecha a medio escribir no filtra; la consulta conserva el resultado anterior mientras carga.
  const purchases = usePurchases({
    supplierId: supplier === 'todos' ? undefined : Number(supplier),
    from: !fromErr && from ? from : undefined,
    to: !toErr && to ? to : undefined,
  });
  const list = purchases.data ?? [];
  const filtered = supplier !== 'todos' || !!from || !!to;
  const clear = () => { setSupplier('todos'); setFrom(''); setTo(''); };

  return (
    <Screen refreshing={purchases.isRefetching} onRefresh={() => { purchases.refetch(); suppliers.refetch(); }}>
      <AppButton label="Registrar compra" icon="cart-plus" onPress={() => router.push('/compra/nueva')} />
      <View style={{ gap: 6 }}>
        <Text style={type.label}>Proveedor</Text>
        <Chips
          options={[{ value: 'todos', label: 'Todos' }, ...(suppliers.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
          value={supplier}
          onChange={setSupplier}
        />
      </View>
      <View style={styles.row}>
        <Field half label="Desde" value={from} onChangeText={(t) => setFrom(t.trim())} error={fromErr} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
        <Field half label="Hasta" value={to} onChangeText={(t) => setTo(t.trim())} error={toErr} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
      </View>

      {purchases.isPending ? (
        <StateView kind="loading" />
      ) : purchases.isError && !purchases.data ? (
        <StateView kind="error" message={purchases.error.message} onRetry={() => purchases.refetch()} />
      ) : list.length === 0 ? (
        <StateView
          kind="empty"
          icon="cart-outline"
          title={filtered ? 'Ninguna compra coincide' : 'Aún no hay compras'}
          action={filtered ? { label: 'Quitar filtros', onPress: clear } : { label: 'Registrar compra', onPress: () => router.push('/compra/nueva') }}
        />
      ) : (
        <Card title={`${list.length} compra${list.length === 1 ? '' : 's'}`} right={<Text style={styles.sum}>{money(list.reduce((t, p) => t + p.total, 0))}</Text>}>
          {list.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push({ pathname: '/compra/[id]', params: { id: String(p.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`Compra ${p.id} a ${p.supplierName} del ${p.date}, ${money(p.total)}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.supplierName}</Text>
                <Text style={type.small}>{p.date} · {p.itemCount} producto{p.itemCount === 1 ? '' : 's'} · {p.user}</Text>
              </View>
              <Text style={styles.sum}>{money(p.total)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sum: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
