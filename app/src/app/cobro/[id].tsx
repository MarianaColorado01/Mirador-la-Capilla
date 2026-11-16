import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { calculateBill, type PaymentMethod } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Field, ItemRow, MoneyRow } from '@/components/ui';
import { useAccount, useConnection, useInvalidateFloor, useSettings } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, radius, space, type } from '@/theme';
import { money, pad } from '@/utils/format';

/** RF-39 a RF-42: cálculo en vivo, validaciones, método de pago y factura. */
export default function Cobro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const account = useAccount(accountId);
  const settings = useSettings();
  const conn = useConnection();
  const invalidate = useInvalidateFloor();

  const [discount, setDiscount] = useState('');
  const [tip, setTip] = useState<string | null>(null); // null = usar la sugerida
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [received, setReceived] = useState('');

  const charge = useMutation({
    mutationFn: (body: Parameters<typeof api.charge>[1]) => api.charge(accountId, body),
    onSuccess: (inv) => {
      invalidate(accountId);
      router.dismissAll();
      router.push({ pathname: '/factura/[id]', params: { id: String(inv.id), fresh: '1' } });
    },
    onError: (e) => {
      // Si la respuesta se perdió pero el cobro sí entró, la cuenta pasa a «pagada» y aparece la factura.
      invalidate(accountId);
      if (!(e instanceof ApiError && e.field && ['discount', 'tipPercent', 'received'].includes(e.field))) Alert.alert('No se pudo cobrar', (e as Error).message);
    },
  });

  if (account.isPending || settings.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (account.isError || settings.isError) {
    return (
      <Screen>
        <StateView kind="error" message={((account.error ?? settings.error) as Error).message} onRetry={() => { account.refetch(); settings.refetch(); }} />
      </Screen>
    );
  }

  const a = account.data;
  const tipText = tip ?? String(settings.data.suggestedTipPercent);
  const b = calculateBill({ subtotal: a.subtotal, discount, tipPercent: tipText, taxPercent: settings.data.taxPercent, method, received });
  // El servidor vuelve a validar; si responde con un campo, se muestra en ese campo.
  const serverErr = charge.error instanceof ApiError && charge.error.field ? { [charge.error.field]: charge.error.message } : {};
  const errors = { ...serverErr, ...b.errors } as Record<string, string | undefined>;
  const suggestion = Math.ceil(b.total / 10000) * 10000;

  if (a.status !== 'por_cobrar') {
    return (
      <Screen>
        <StateView kind="empty" icon="cash-lock" title={a.status === 'pagada' ? 'Esta cuenta ya está pagada' : 'La cuenta todavía está abierta'} message={a.status === 'abierta' ? 'Primero hay que pedir la cuenta.' : undefined} action={
            a.status === 'pagada' && a.invoiceId
              ? { label: 'Ver factura', onPress: () => router.replace({ pathname: '/factura/[id]', params: { id: String(a.invoiceId) } }) }
              : { label: 'Volver', onPress: () => router.back() }
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <AppButton
          label={`Cobrar ${money(b.total)} y facturar`}
          icon="receipt"
          disabled={!b.ready || conn === 'off'}
          loading={charge.isPending}
          onPress={() => charge.mutate({ discount, tipPercent: tipText, method, received: method === 'efectivo' ? received : undefined })}
        />
      }
    >
      <Stack.Screen options={{ title: `Cobrar mesa ${pad(a.tableNumber)}` }} />
      <Card title={`${a.rounds.length} ${a.rounds.length === 1 ? 'ronda' : 'rondas'} · ${a.waiter}`}>
        {a.rounds.flatMap((r) => r.items).map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </Card>

      <View style={styles.two}>
        <Field half keyboardType="numeric" label="Descuento ($)" value={discount} onChangeText={(t) => { setDiscount(t); charge.reset(); }} error={errors.discount} placeholder="0" />
        <Field half keyboardType="numeric" label="Propina (%)" value={tipText} onChangeText={(t) => { setTip(t); charge.reset(); }} error={errors.tipPercent} help={`Sugerida: ${settings.data.suggestedTipPercent} %`} />
      </View>

      <Card>
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <MoneyRow label="Subtotal" value={a.subtotal} />
          <MoneyRow label="Descuento" value={b.discount ? -b.discount : 0} />
          <MoneyRow label={`Propina ${b.tipPercent} %`} value={b.tip} />
          <MoneyRow label={`Impuesto ${settings.data.taxPercent} %`} value={b.tax} />
          <MoneyRow label="Total" value={b.total} strong />
        </View>
      </Card>

      <Text style={type.label}>Método de pago</Text>
      <Chips<PaymentMethod>
        value={method}
        onChange={(m) => { setMethod(m); charge.reset(); }}
        options={[
          { value: 'efectivo', label: 'Efectivo' },
          { value: 'tarjeta', label: 'Tarjeta' },
          { value: 'transferencia', label: 'Transferencia' },
        ]}
      />
      {method === 'efectivo' && (
        <View style={styles.two}>
          <Field half keyboardType="numeric" label="Recibido" value={received} onChangeText={(t) => { setReceived(t); charge.reset(); }} error={errors.received} placeholder={`Ej. ${money(suggestion)}`} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.lb}>Cambio</Text>
            <View style={[styles.input, styles.ro]}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>{b.change != null ? money(b.change) : '—'}</Text>
            </View>
          </View>
        </View>
      )}
      <Text style={type.small}>Al cobrar se genera la factura con el siguiente número consecutivo y la mesa {a.tableNumber} queda libre.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: space.md },
  lb: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 17, backgroundColor: colors.face, justifyContent: 'center' },
  ro: { backgroundColor: colors.face2 },
});
