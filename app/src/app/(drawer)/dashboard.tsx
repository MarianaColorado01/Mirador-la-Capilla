import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, MoneyRow } from '@/components/ui';
import { useSummary } from '@/hooks/queries';
import { colors, radius, space, type } from '@/theme';
import { money, periodRange, shortDate, type Period } from '@/utils/format';

const LABEL: Record<Period, string> = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes' };

/** RF-58 a RF-60: ventas, costo de lo vendido, surtido, otros gastos y utilidad estimada. */
function Dashboard() {
  const [period, setPeriod] = useState<Period>('hoy');
  const summary = useSummary(periodRange(period));

  return (
    <Screen refreshing={summary.isRefetching} onRefresh={() => summary.refetch()}>
      <Chips<Period> value={period} onChange={setPeriod} options={[{ value: 'hoy', label: 'Hoy' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
      {summary.isPending ? (
        <StateView kind="loading" message="Calculando…" />
      ) : summary.isError ? (
        <StateView kind="error" message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
      ) : (
        (() => {
          const s = summary.data;
          const max = Math.max(1, ...s.salesByDay.map((d) => d.sales));
          const maxQty = Math.max(1, ...s.topProducts.map((p) => p.qty));
          const days = s.salesByDay.slice(-14);
          return (
            <>
              <Card>
                <View style={{ padding: space.lg, paddingBottom: space.sm }}>
                  <Text style={type.label}>Utilidad estimada · {LABEL[period]}</Text>
                  <Text style={[type.figure, { color: s.profit >= 0 ? colors.green : colors.red }]}>{money(s.profit)}</Text>
                </View>
                <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
                  <MoneyRow label={`Ventas · ${s.invoices} ${s.invoices === 1 ? 'factura' : 'facturas'}`} value={s.sales} />
                  <MoneyRow label="Costo de lo vendido" value={-s.costOfSales} />
                  <MoneyRow label="Otros gastos" value={-s.otherExpenses} />
                </View>
                <View style={styles.apart}>
                  <Text style={[type.small, { flex: 1 }]}>Gasto en surtido · se reporta aparte porque ya entra como costo de lo vendido</Text>
                  <Text style={styles.strong}>{money(s.purchases)}</Text>
                </View>
              </Card>

              {days.length > 1 && (
                <Card title="Ventas por día" right={<Text style={type.label}>miles</Text>}>
                  <View style={styles.chart} accessibilityLabel="Gráfica de ventas por día">
                    {days.map((d) => (
                      <View key={d.date} style={styles.col}>
                        <Text style={styles.colValue}>{d.sales ? Math.round(d.sales / 1000) : ''}</Text>
                        <View style={[styles.bar, { height: `${Math.max(2, (d.sales / max) * 100)}%`, backgroundColor: d.sales === max ? colors.trim : colors.steel }]} />
                        <Text style={styles.colLabel}>{shortDate(d.date).slice(0, 2)}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              )}

              <Card title="Más vendidos" right={<Text style={type.label}>unid.</Text>}>
                {s.topProducts.length === 0 ? (
                  <Text style={[type.small, { padding: space.lg }]}>Aún no hay ventas en el periodo.</Text>
                ) : (
                  s.topProducts.map((p) => (
                    <View key={p.productId} style={styles.row}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={type.body}>{p.name}</Text>
                        <View style={styles.track}><View style={[styles.fill, { width: `${(p.qty / maxQty) * 100}%` }]} /></View>
                      </View>
                      <Text style={styles.strong}>{p.qty}</Text>
                    </View>
                  ))
                )}
              </Card>

              <Card title="Ventas por mesero">
                <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
                  {s.salesByWaiter.length === 0 ? <Text style={type.small}>Sin ventas.</Text> : s.salesByWaiter.map((w) => <MoneyRow key={w.waiter} label={`${w.waiter} · ${w.invoices}`} value={w.sales} />)}
                </View>
              </Card>

              <Card title="Margen por producto" right={<Text style={type.label}>precio − costo</Text>}>
                <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
                  {s.margins.map((m) => (
                    <MoneyRow key={m.productId} label={m.name} value={`${money(m.margin)} · ${Math.round((m.margin / m.price) * 100)} %`} />
                  ))}
                </View>
              </Card>
            </>
          );
        })()
      )}
    </Screen>
  );
}

export default function DashboardScreen() {
  return <RoleGate roles={['dueno']}><Dashboard /></RoleGate>;
}

const styles = StyleSheet.create({
  apart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.lg, backgroundColor: colors.face2, borderTopWidth: 1, borderTopColor: colors.line },
  strong: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 170, padding: space.md },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  colValue: { color: colors.ink3, fontSize: 10 },
  bar: { width: '100%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  colLabel: { color: colors.ink3, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.trim },
});
