import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, ItemRow, MoneyRow } from '@/components/ui';
import { keys, useConnection, useInvoice } from '@/hooks/queries';
import { api, type ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';
import { dateTime, pad } from '@/utils/format';

const METHOD = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' } as const;

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
      {voiding && <VoidInvoiceSheet invoiceId={v.id} number={v.number} onClose={() => setVoiding(false)} />}
    </Screen>
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
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
        <Text style={type.h}>Anular factura {pad(number, 6)}</Text>
        <Text style={type.small}>Lo vendido vuelve al inventario. El número no se reutiliza y la mesa no se reabre.</Text>
        <View style={{ gap: 4 }}>
          <TextInput
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              setTouched(true);
            }}
            placeholder="Motivo de la anulación"
            placeholderTextColor={colors.ink3}
            maxLength={200}
            style={[styles.input, fieldErr ? { borderColor: colors.red } : null]}
            accessibilityLabel="Motivo de la anulación"
          />
          {fieldErr && <Text style={styles.error}>{fieldErr}</Text>}
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

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, gap: space.md },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  error: { color: colors.red, fontSize: 13 },
  block: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  number: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
