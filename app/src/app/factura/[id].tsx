import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BUSINESS_NAME, invoiceHtml, METHOD_LABEL as METHOD, type Invoice } from '@mirador/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, ItemRow, MoneyRow } from '@/components/ui';
import { keys, useConnection, useInvoice, useSettings } from '@/hooks/queries';
import { api, type ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, space, tabular, text } from '@/theme';
import { dateTime, pad } from '@/utils/format';

/** RF-42 a RF-44: factura emitida, su detalle y su anulación. Un id inexistente muestra «Factura no encontrada». */
export default function Factura() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const invoice = useInvoice(Number(id));
  const isOwner = useSession((s) => s.user!.role === 'dueno');
  const [voiding, setVoiding] = useState(false);

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
  const footer = fresh ? (
    <AppButton label="Listo" icon="check" onPress={() => router.dismissAll()} />
  ) : isOwner && !v.voided ? (
    <AppButton label="Anular factura" icon="close-circle-outline" variant="danger" onPress={() => setVoiding(true)} />
  ) : undefined;
  return (
    <Screen footer={footer}>
      <Stack.Screen options={{ title: `Factura ${pad(v.number, 6)}` }} />
      {fresh && <Banner tone="green" icon="check-circle-outline" title={`Pago registrado · Mesa ${pad(v.tableNumber)} liberada`} text="La mesa vuelve a «libre» en todos los celulares." />}
      {v.voided && <Banner tone="red" icon="close-circle-outline" title="Factura anulada" text={`${v.voided.by} · ${v.voided.reason}`} />}
      <Card title="Factura N.º" right={<Text className="font-display text-[20px] text-ink" style={tabular}>{pad(v.number, 6)}</Text>}>
        <View className="px-lg py-sm">
          <MoneyRow label="Fecha" value={dateTime(v.createdAt)} />
          <MoneyRow label="Mesa · Mesero" value={`${pad(v.tableNumber)} · ${v.waiter}`} />
          <MoneyRow label="Cobró" value={v.cashier} />
          <MoneyRow label="Método" value={METHOD[v.method]} />
        </View>
        {v.items.filter((i) => !i.voided).map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
        <View className="px-lg py-sm">
          <MoneyRow label="Subtotal" value={v.subtotal} />
          {v.discount > 0 && <MoneyRow label="Descuento" value={-v.discount} />}
          <MoneyRow label={`Propina ${v.tipPercent} %`} value={v.tip} />
          <MoneyRow label={`Impuesto ${v.taxPercent} %`} value={v.tax} />
          <MoneyRow label="Total" value={v.total} strong />
        </View>
        {/* RF-46: uno o varios pagos; en efectivo el cambio es por pago */}
        <View className="px-lg py-sm">
          {v.payments.map((p, i) => (
            <View key={i}>
              <MoneyRow label={v.payments.length > 1 ? `Pago ${i + 1} · ${METHOD[p.method]}` : `Pagado · ${METHOD[p.method]}`} value={p.amount} />
              {p.received != null && <MoneyRow label="Recibido" value={p.received} />}
              {p.change != null && <MoneyRow label="Cambio" value={p.change} />}
            </View>
          ))}
        </View>
      </Card>
      <SharePdf invoice={v} />
      <Text className={text.small}>Numeración consecutiva. La factura queda guardada en el servidor del local.</Text>
      {voiding && <VoidInvoiceSheet invoiceId={v.id} number={v.number} onClose={() => setVoiding(false)} />}
    </Screen>
  );
}

/** RF-45: arma el PDF en el celular con la factura ya cargada; no necesita el servidor. */
function SharePdf({ invoice }: { invoice: Invoice }) {
  const businessName = useSettings().data?.businessName ?? BUSINESS_NAME;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await isAvailableAsync())) return setError('Este celular no permite compartir archivos.');
      const { uri } = await printToFileAsync({ html: invoiceHtml(invoice, businessName) });
      await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Factura ${pad(invoice.number, 6)}` });
    } catch {
      setError('No se pudo generar o compartir el PDF. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppButton label="Compartir PDF" icon="file-pdf-box" variant="outline" loading={busy} onPress={share} />
      {error && <Banner tone="red" icon="alert-circle-outline" title={error} />}
    </>
  );
}

/** RF-44: solo el dueño anula, con motivo obligatorio. Lo vendido vuelve al stock. */
function VoidInvoiceSheet({ invoiceId, number, onClose }: { invoiceId: number; number: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const conn = useConnection();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const mut = useMutation<unknown, ApiError, string>({
    mutationFn: (r) => api.voidInvoice(invoiceId, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.invoice(invoiceId) });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: keys.products });
      qc.invalidateQueries({ queryKey: keys.reports }); // la factura anulada sale del Resumen
      onClose();
    },
  });
  const short = reason.trim().length < 3;
  const fieldErr = touched && short ? 'Escribe el motivo (mínimo 3 caracteres)' : mut.error?.field === 'reason' ? mut.error.message : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60" onPress={onClose} accessibilityLabel="Cerrar" />
      <View className="bg-face rounded-t-[18px] p-lg gap-md" style={{ paddingBottom: space.lg + insets.bottom }}>
        <Text className={text.h}>Anular factura {pad(number, 6)}</Text>
        <Text className={text.small}>Lo vendido vuelve al inventario. El número no se reutiliza y la mesa no se reabre.</Text>
        <View className="gap-xs">
          <TextInput
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              setTouched(true);
            }}
            placeholder="Motivo de la anulación"
            placeholderTextColor={colors.ink3}
            maxLength={200}
            className={`min-h-[48px] border rounded-md px-md font-body text-[16px] text-ink ${fieldErr ? 'border-red' : 'border-line'}`}
            accessibilityLabel="Motivo de la anulación"
          />
          {fieldErr && <Text className="font-body text-[13px] text-red">{fieldErr}</Text>}
        </View>
        {mut.error && mut.error.field !== 'reason' && <Banner tone="red" icon="alert-circle-outline" title={mut.error.message} />}
        <AppButton
          label={conn === 'off' ? 'Sin conexión' : 'Anular factura'}
          icon="close-circle-outline"
          variant="danger"
          loading={mut.isPending}
          disabled={short || conn === 'off'}
          onPress={() => mut.mutate(reason.trim())}
        />
        <AppButton label="Cancelar" variant="text" onPress={onClose} />
      </View>
    </Modal>
  );
}
