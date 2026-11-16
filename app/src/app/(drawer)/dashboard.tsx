import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { localDate, periodRange, type Period, type ReportSummary } from '@mirador/shared';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, MoneyRow } from '@/components/ui';
import { useAllProducts, useSummary } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money, PERIOD_OPTIONS, PERIOD_TEXT } from '@/utils/format';

const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const parse = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

/** Todos los días del rango con su venta; los días sin facturas valen 0. */
function days(s: ReportSummary) {
  const byDay = new Map(s.byDay.map((d) => [d.date, d.sales]));
  const out: { date: Date; key: string; sales: number }[] = [];
  for (let d = parse(s.from); localDate(d) <= s.to; d.setDate(d.getDate() + 1)) out.push({ date: new Date(d), key: localDate(d), sales: byDay.get(localDate(d)) ?? 0 });
  return out;
}

/**
 * RF-58 a RF-60: resumen del negocio para el dueño. Ventas = facturas no anuladas, subtotal − descuento
 * (sin propina ni impuesto). Utilidad = ventas − costo de lo vendido − otros gastos; el surtido se muestra
 * aparte y no se resta porque ya entra como costo de lo vendido (sección 4.3).
 */
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('hoy');
  const summary = useSummary(periodRange(period));
  const products = useAllProducts();
  const s = summary.data;

  return (
    <Screen refreshing={summary.isRefetching} onRefresh={() => { summary.refetch(); products.refetch(); }}>
      <Chips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      {summary.isPending ? (
        <StateView kind="loading" />
      ) : summary.isError && !s ? (
        <StateView kind="error" message={summary.error.message} onRetry={() => summary.refetch()} />
      ) : s ? (
        <>
          <Card>
            <View style={styles.body}>
              <Text style={type.label}>Utilidad estimada · {PERIOD_TEXT[period]}</Text>
              <Text style={[type.figure, { color: s.profit < 0 ? colors.red : colors.green }]}>{money(s.profit)}</Text>
              <View>
                <MoneyRow label="Ventas" value={s.sales} />
                <MoneyRow label="Costo de lo vendido" value={money(-s.costOfSales)} />
                <MoneyRow label="Otros gastos" value={money(-s.otherExpenses)} />
              </View>
              <Text style={type.small}>
                {s.invoiceCount} factura{s.invoiceCount === 1 ? '' : 's'} · ticket promedio {money(s.averageTicket)}
              </Text>
            </View>
            <View style={styles.aside}>
              <MoneyRow label="Gasto en surtido (aparte, no se resta)" value={s.purchases} />
              <MoneyRow label="Propinas (del personal)" value={s.tips} />
              <MoneyRow label="Impuesto cobrado" value={s.taxes} />
            </View>
          </Card>

          <SalesChart s={s} />

          <Card title="Más vendidos" right={<Text style={type.label}>Unid. · importe</Text>}>
            {s.topProducts.length === 0 ? (
              <Text style={[type.small, styles.pad]}>Sin ventas {PERIOD_TEXT[period]}.</Text>
            ) : (
              s.topProducts.map((p) => (
                <View key={p.productId} style={styles.line}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <View style={styles.track}><View style={[styles.fill, { width: `${(p.qty / s.topProducts[0].qty) * 100}%` }]} /></View>
                  </View>
                  <Text style={styles.num}>{p.qty}</Text>
                  <Text style={[styles.num, styles.amount]}>{money(p.amount)}</Text>
                </View>
              ))
            )}
          </Card>

          <Card title="Ventas por mesero">
            {s.byWaiter.length === 0 ? (
              <Text style={[type.small, styles.pad]}>Sin ventas {PERIOD_TEXT[period]}.</Text>
            ) : (
              s.byWaiter.map((w) => (
                <View key={w.waiterId} style={styles.line}>
                  <Text style={[styles.name, { flex: 1 }]}>{w.name}</Text>
                  <Text style={type.small}>{w.invoices} fact.</Text>
                  <Text style={[styles.num, styles.amount]}>{money(w.sales)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      <Margins products={products} />
    </Screen>
  );
}

/** RF-59: barras con View, alturas proporcionales a la venta más alta del rango. Sin librerías. */
function SalesChart({ s }: { s: ReportSummary }) {
  const list = days(s);
  const max = Math.max(...list.map((d) => d.sales), 1);
  const few = list.length <= 7;
  const total = list.reduce((t, d) => t + d.sales, 0);
  return (
    <Card title="Ventas por día" right={<Text style={type.label}>{few ? 'Miles' : `${list.length} días`}</Text>}>
      <View style={styles.chart}>
        {list.map((d, i) => {
          // Con muchos días solo se rotulan algunos para que se lean.
          const label = few ? `${WEEKDAY[d.date.getDay()]} ${d.date.getDate()}` : i % 5 === 0 || i === list.length - 1 ? String(d.date.getDate()) : '';
          return (
            <View key={d.key} style={styles.col} accessible accessibilityLabel={`${d.key}: ${money(d.sales)}`}>
              <View style={styles.barArea}>
                {few && <Text style={styles.barValue}>{Math.round(d.sales / 1000)}</Text>}
                <View style={[styles.bar, { height: `${(d.sales / max) * 85}%` }, d.key === localDate() && { backgroundColor: colors.trim }]} />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[type.small, styles.pad]}>Total del rango: {money(total)}</Text>
    </Card>
  );
}

/** RF-60: margen = precio − costo, y % sobre el precio. Ordenable por pesos o por porcentaje. */
function Margins({ products }: { products: ReturnType<typeof useAllProducts> }) {
  const [by, setBy] = useState<'pesos' | 'pct'>('pesos');
  if (products.isPending) return <StateView kind="loading" />;
  if (products.isError && !products.data) return <StateView kind="error" message={products.error.message} onRetry={() => products.refetch()} />;
  const rows = (products.data ?? [])
    .filter((p) => p.active && p.margin !== null)
    .map((p) => ({ id: p.id, name: p.name, margin: p.margin!, pct: Math.round((p.margin! / p.price) * 100) }))
    .sort((a, b) => (by === 'pesos' ? b.margin - a.margin : b.pct - a.pct));
  return (
    <Card title="Margen por producto" right={<Text style={type.label}>Precio − costo</Text>}>
      <View style={styles.pad}>
        <Chips options={[{ value: 'pesos', label: 'Por pesos' }, { value: 'pct', label: 'Por %' }]} value={by} onChange={setBy} />
      </View>
      {rows.length === 0 && <Text style={[type.small, styles.pad]}>No hay productos activos.</Text>}
      {rows.map((p) => (
        <View key={p.id} style={styles.line}>
          <Text style={[styles.name, { flex: 1 }]}>{p.name}</Text>
          <Text style={[styles.num, p.margin <= 0 && { color: colors.red }]}>{money(p.margin)}</Text>
          <Text style={[type.small, styles.pct]}>{p.pct} %</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.sm },
  aside: { paddingHorizontal: space.lg, paddingVertical: space.xs, backgroundColor: colors.face2, borderTopWidth: 1, borderTopColor: colors.line },
  pad: { padding: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  num: { color: colors.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  amount: { minWidth: 96, textAlign: 'right' },
  pct: { minWidth: 44, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line2, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.steel },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 180, paddingHorizontal: 14, paddingTop: 14 },
  col: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  // 85 %: deja sitio a la cifra sobre la barra más alta.
  barArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  bar: { width: '100%', minHeight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.steel },
  barValue: { color: colors.ink2, fontSize: 11, fontVariant: ['tabular-nums'] },
  barLabel: { color: colors.ink3, fontSize: 11, height: 14 },
});
