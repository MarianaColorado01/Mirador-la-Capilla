import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, ItemRow, MoneyRow } from '@/components/ui';
import { useInvoice } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { dateTime, pad } from '@/utils/format';

const METHOD = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' } as const;

/** RF-42 / RF-43: factura emitida y su detalle. Un id inexistente muestra «Factura no encontrada». */
export default function Factura() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const invoice = useInvoice(Number(id));

  if (invoice.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (invoice.isError) {
    const notFound = (invoice.error as Error).message === 'Factura no encontrada';
    return (
      <Screen>
        {notFound ? (
          <StateView kind="empty" icon="receipt" title="Factura no encontrada" action={{ label: 'Volver', onPress: () => router.back() }} />
        ) : (
          <StateView kind="error" message={(invoice.error as Error).message} onRetry={() => invoice.refetch()} />
        )}
      </Screen>
    );
  }

  const v = invoice.data;
  return (
    <Screen footer={fresh ? <AppButton label="Listo" icon="check" onPress={() => router.dismissAll()} /> : undefined}>
      <Stack.Screen options={{ title: `Factura ${pad(v.number, 6)}` }} />
      {fresh && <Banner tone="green" icon="check-circle-outline" title={`Pago registrado · Mesa ${pad(v.tableNumber)} liberada`} text="La mesa vuelve a «libre» en todos los celulares." />}
      {v.voided && <Banner tone="red" icon="close-circle-outline" title="Factura anulada" text={`${v.voided.by} · ${v.voided.reason}`} />}
      <Card title="Factura N.º" right={<Text style={styles.number}>{pad(v.number, 6)}</Text>}>
        <View style={styles.block}>
          <MoneyRow label="Fecha" value={dateTime(v.createdAt)} />
          <MoneyRow label="Mesa · Mesero" value={`${pad(v.tableNumber)} · ${v.waiter}`} />
          <MoneyRow label="Cobró" value={v.cashier} />
          <MoneyRow label="Método" value={METHOD[v.method]} />
        </View>
        {v.items.filter((i) => !i.voided).map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
        <View style={styles.block}>
          <MoneyRow label="Subtotal" value={v.subtotal} />
          {v.discount > 0 && <MoneyRow label="Descuento" value={-v.discount} />}
          <MoneyRow label={`Propina ${v.tipPercent} %`} value={v.tip} />
          <MoneyRow label={`Impuesto ${v.taxPercent} %`} value={v.tax} />
          <MoneyRow label="Total" value={v.total} strong />
          {v.received != null && <MoneyRow label="Recibido" value={v.received} />}
          {v.change != null && <MoneyRow label="Cambio" value={v.change} />}
        </View>
      </Card>
      <Text style={type.small}>Numeración consecutiva. La factura queda guardada en el servidor del local.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  number: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
