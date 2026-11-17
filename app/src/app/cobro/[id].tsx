import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { calculateBill, equalShares, splitPayments, type PaymentInput, type PaymentMethod } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Field, ItemRow, MoneyRow } from '@/components/ui';
import { useAccount, useConnection, useInvalidateFloor, useSettings } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { tabular, text } from '@/theme';
import { money, pad } from '@/utils/format';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
];

/** RF-39 a RF-42: cálculo en vivo, validaciones, método de pago y factura. RF-46: dividir el pago. */
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
  const [split, setSplit] = useState<PaymentInput[] | null>(null); // null = un solo pago

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
      if (!(e instanceof ApiError && e.field && (['discount', 'tipPercent', 'received'].includes(e.field) || e.field.startsWith('payments')))) Alert.alert('No se pudo cobrar', (e as Error).message);
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
  const b = calculateBill({ subtotal: a.subtotal, discount, tipPercent: tipText, taxPercent: settings.data.taxPercent, method: split ? undefined : method, received });
  const sp = split && splitPayments(b.total, split);
  // El servidor vuelve a validar; si responde con un campo, se muestra en ese campo.
  const serverErr = charge.error instanceof ApiError && charge.error.field ? { [charge.error.field]: charge.error.message } : {};
  const errors = { ...serverErr, ...b.errors, ...(sp ? sp.errors : {}) } as Record<string, string | undefined>;
  const setRow = (i: number, patch: Partial<PaymentInput>) => { setSplit(split!.map((r, j) => (j === i ? { ...r, ...patch } : r))); charge.reset(); };
  // Reparte el total entre n personas conservando el método que ya tenía cada fila.
  const shareEqually = (n: number) => {
    setSplit(equalShares(b.total, n).map((amt, i) => ({ method: split?.[i]?.method ?? 'efectivo', amount: String(amt), received: '' })));
    charge.reset();
  };
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
          disabled={!b.ready || (!!sp && !sp.ready) || conn === 'off'}
          loading={charge.isPending}
          onPress={() => charge.mutate(split
            ? { discount, tipPercent: tipText, payments: split.map((r) => ({ ...r, received: r.method === 'efectivo' ? r.received : undefined })) }
            : { discount, tipPercent: tipText, method, received: method === 'efectivo' ? received : undefined })}
        />
      }
    >
      <Stack.Screen options={{ title: `Cobrar mesa ${pad(a.tableNumber)}` }} />
      <Card title={`${a.rounds.length} ${a.rounds.length === 1 ? 'ronda' : 'rondas'} · ${a.waiter}`}>
        {a.rounds.flatMap((r) => r.items).map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </Card>

      <View className="flex-row gap-md">
        <Field half keyboardType="numeric" label="Descuento ($)" value={discount} onChangeText={(t) => { setDiscount(t); charge.reset(); }} error={errors.discount} placeholder="0" />
        <Field half keyboardType="numeric" label="Propina (%)" value={tipText} onChangeText={(t) => { setTip(t); charge.reset(); }} error={errors.tipPercent} help={`Sugerida: ${settings.data.suggestedTipPercent} %`} />
      </View>

      <Card>
        <View className="px-lg py-sm">
          <MoneyRow label="Subtotal" value={a.subtotal} />
          <MoneyRow label="Descuento" value={b.discount ? -b.discount : 0} />
          <MoneyRow label={`Propina ${b.tipPercent} %`} value={b.tip} />
          <MoneyRow label={`Impuesto ${settings.data.taxPercent} %`} value={b.tax} />
          <MoneyRow label="Total" value={b.total} strong />
        </View>
      </Card>

      {split && sp ? (
        <>
          <Text className={text.label}>Pagos</Text>
          <Text className={text.small}>Partes iguales entre:</Text>
          <Chips<string>
            value={String(split.length)}
            onChange={(n) => shareEqually(Number(n))}
            options={['2', '3', '4', '5', '6'].map((n) => ({ value: n, label: `${n} personas` }))}
          />
          {split.map((row, i) => (
            <Card key={i} title={`Pago ${i + 1}`} right={split.length > 1 ? (
              <AppButton compact variant="text" icon="close" label="Quitar" onPress={() => { setSplit(split.filter((_, j) => j !== i)); charge.reset(); }} />
            ) : undefined}>
              <View className="p-md gap-sm">
                <Chips<PaymentMethod> value={row.method} onChange={(m) => setRow(i, { method: m })} options={METHODS} />
                <View className="flex-row gap-md">
                  <Field half keyboardType="numeric" label="Monto" accessibilityLabel={`Monto del pago ${i + 1}`} value={row.amount} onChangeText={(t) => setRow(i, { amount: t })} error={errors[`payments.${i}.amount`]} />
                  {row.method === 'efectivo' && (
                    <Field half keyboardType="numeric" label="Recibido" accessibilityLabel={`Recibido en el pago ${i + 1}`} value={row.received} onChangeText={(t) => setRow(i, { received: t })} error={errors[`payments.${i}.received`]}
                      help={sp.payments[i]?.change != null ? `Cambio: ${money(sp.payments[i]!.change!)}` : undefined} />
                  )}
                </View>
              </View>
            </Card>
          ))}
          {split.length < 10 && (
            <AppButton variant="outline" icon="plus" label="Agregar pago" onPress={() => { setSplit([...split, { method: 'tarjeta', amount: sp.remaining > 0 ? String(sp.remaining) : '' }]); charge.reset(); }} />
          )}
          <Card>
            <View className="px-lg py-sm">
              <MoneyRow label={sp.remaining > 0 ? 'Falta por cubrir' : sp.remaining < 0 ? 'Sobra' : 'Cubierto'} value={Math.abs(sp.remaining)} strong />
            </View>
          </Card>
          {errors.payments && <Text className="font-body text-[13px] text-red">{errors.payments}</Text>}
          <AppButton variant="text" icon="cash" label="Volver a un solo pago" onPress={() => { setSplit(null); charge.reset(); }} />
        </>
      ) : (
        <>
          <Text className={text.label}>Método de pago</Text>
          <Chips<PaymentMethod>
            value={method}
            onChange={(m) => { setMethod(m); charge.reset(); }}
            options={METHODS}
          />
          {method === 'efectivo' && (
            <View className="flex-row gap-md">
              <Field half keyboardType="numeric" label="Recibido" value={received} onChangeText={(t) => { setReceived(t); charge.reset(); }} error={errors.received} placeholder={`Ej. ${money(suggestion)}`} />
              <View className="flex-1 gap-[6px]">
                <Text className="font-body-semi text-[13px] text-ink2">Cambio</Text>
                <View className="min-h-[50px] border border-line rounded-md px-md bg-face2 justify-center">
                  <Text className="font-display text-[19px] text-ink" style={tabular}>{b.change != null ? money(b.change) : '—'}</Text>
                </View>
              </View>
            </View>
          )}
          <AppButton variant="outline" icon="call-split" label="Dividir pago" onPress={() => shareEqually(2)} />
        </>
      )}
      <Text className={text.small}>Al cobrar se genera la factura con el siguiente número consecutivo y la mesa {a.tableNumber} queda libre.</Text>
    </Screen>
  );
}
