import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isDate, periodRange, type Period, type PurchasesBySupplier } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Field, Tag } from '@/components/ui';
import { usePurchases, usePurchasesBySupplier, useSuppliers } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money, PERIOD_OPTIONS, PERIOD_TEXT } from '@/utils/format';

const dateError = (v: string) => (v === '' || isDate(v) ? undefined : 'Escribe la fecha como AAAA-MM-DD');

type Tab = 'historial' | 'proveedor';
const TABS: { value: Tab; label: string }[] = [{ value: 'historial', label: 'Historial' }, { value: 'proveedor', label: 'Por proveedor' }];

/**
 * RF-55: historial de compras filtrable por proveedor y rango de fechas (dueño). ?supplierId= llega desde el proveedor.
 * RF-56: «Por proveedor» resume el período; tocar un proveedor abre el historial filtrado por él y ese período.
 */
export default function Compras() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const [view, setView] = useState<Tab>('historial');
  const [period, setPeriod] = useState<Period>('mes');
  const report = usePurchasesBySupplier(periodRange(period), view === 'proveedor');
  const suppliers = useSuppliers();
  const [supplier, setSupplier] = useState(params.supplierId ?? 'todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // El Drawer conserva la pantalla montada: si se vuelve a abrir desde otro proveedor, se toma el nuevo filtro.
  const [seen, setSeen] = useState(params.supplierId);
  if (params.supplierId !== seen) {
    setSeen(params.supplierId);
    if (params.supplierId) { setSupplier(params.supplierId); setView('historial'); }
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
  const pick = (supplierId: number) => {
    const r = periodRange(period);
    setSupplier(String(supplierId)); setFrom(r.from); setTo(r.to); setView('historial');
  };

  if (view === 'proveedor') {
    return (
      <Screen refreshing={report.isRefetching} onRefresh={() => report.refetch()}>
        <Chips options={TABS} value={view} onChange={setView} />
        <Chips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        {report.isPending ? (
          <StateView kind="loading" />
        ) : report.isError && !report.data ? (
          <StateView kind="error" message={report.error.message} onRetry={() => report.refetch()} />
        ) : report.data.suppliers.length === 0 ? (
          <StateView kind="empty" icon="truck-outline" title={`Sin compras ${PERIOD_TEXT[period]}`} action={{ label: 'Registrar compra', onPress: () => router.push('/compra/nueva') }} />
        ) : (
          <BySupplier data={report.data} onPick={pick} />
        )}
      </Screen>
    );
  }

  return (
    <Screen refreshing={purchases.isRefetching} onRefresh={() => { purchases.refetch(); suppliers.refetch(); }}>
      <Chips options={TABS} value={view} onChange={setView} />
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

/** RF-56: una tarjeta por proveedor con su total, su parte del total del período (barra) y sus 3 productos principales. */
function BySupplier({ data, onPick }: { data: PurchasesBySupplier; onPick: (supplierId: number) => void }) {
  return (
    <>
      <Card title="Total comprado" right={<Text style={styles.sum}>{money(data.total)}</Text>}>
        <Text style={[type.small, styles.pad]}>{data.from === data.to ? data.from : `${data.from} a ${data.to}`} · toca un proveedor para ver sus compras</Text>
      </Card>
      {data.suppliers.map((s) => {
        const pct = data.total ? Math.round((s.total / data.total) * 100) : 0;
        return (
          <Pressable
            key={s.supplierId}
            onPress={() => onPick(s.supplierId)}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}: ${money(s.total)}, ${pct}% del total, ${s.purchases} compras. Ver historial`}
          >
            {({ pressed }) => (
              <Card style={pressed ? { borderColor: colors.steel } : undefined}>
                <View style={styles.supplier}>
                  <View style={styles.head}>
                    <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                    {!s.active && <Tag label="Inactivo" color={colors.ink3} />}
                    <Text style={styles.sum}>{money(s.total)}</Text>
                  </View>
                  <View style={styles.head}>
                    <View style={[styles.track, { flex: 1 }]}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
                    <Text style={type.small}>{pct}%</Text>
                  </View>
                  <Text style={type.small}>{s.purchases} compra{s.purchases === 1 ? '' : 's'} · última {s.lastDate}</Text>
                  <Text style={type.small} numberOfLines={2}>
                    {s.products.slice(0, 3).map((p) => `${p.name} ×${p.qty} (${money(p.total)})`).join(' · ')}
                  </Text>
                </View>
              </Card>
            )}
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 14, paddingVertical: 10 },
  supplier: { padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line2, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.trim },
  row: { flexDirection: 'row', gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sum: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
