import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fieldErrors, StockAdjustmentSchema, type StockMovement } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Field } from '@/components/ui';
import { keys, useConnection, useProduct } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import type { ProductModel } from '@/services/mappers';
import { space, type } from '@/theme';

const TYPES: { value: StockMovement['type']; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'salida', label: 'Salida' },
  { value: 'ajuste', label: 'Conteo' },
];

/** RF-48: ajuste manual de stock de un producto (?id=). Solo el dueño. */
export default function AjustarStock() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(Number(id));
  const notFound = !(Number(id) > 0) || (product.error instanceof ApiError && product.error.status === 404);
  return (
    <Screen>
      <Stack.Screen options={{ title: product.data ? `Stock · ${product.data.name}` : 'Ajustar stock' }} />
      {notFound ? (
        <StateView kind="empty" icon="bottle-wine-outline" title="Producto no encontrado" action={{ label: 'Volver', onPress: () => router.back() }} />
      ) : product.isPending ? (
        <StateView kind="loading" />
      ) : product.isError ? (
        <StateView kind="error" message={product.error.message} onRetry={() => product.refetch()} />
      ) : (
        <AdjustForm product={product.data} />
      )}
    </Screen>
  );
}

function AdjustForm({ product }: { product: ProductModel }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [kind, setKind] = useState<StockMovement['type']>('entrada');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: api.adjustStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.products });
      router.back();
    },
  });

  // Vacío no es 0: el esquema lo marca como «Escribe un número».
  const parsed = StockAdjustmentSchema.safeParse({ productId: product.id, type: kind, qty: qty === '' ? NaN : Number(qty), reason });
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  const err = (k: string) => (touched[k] || serverErr?.field === k ? errors[k] : undefined);
  const touch = (k: string) => { setTouched((t) => ({ ...t, [k]: true })); save.reset(); };

  const n = Number(qty) || 0;
  const after = kind === 'entrada' ? product.stock + n : kind === 'salida' ? product.stock - n : n;

  return (
    <>
      {serverErr && !serverErr.field && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
      <Card title={`Stock actual: ${product.stock}`}>
        <View style={styles.body}>
          <View style={{ gap: 6 }}>
            <Text style={type.label}>Tipo</Text>
            <Chips options={TYPES} value={kind} onChange={(v) => { setKind(v); save.reset(); }} />
            <Text style={type.small}>
              {kind === 'entrada' ? 'Suma unidades que llegaron.' : kind === 'salida' ? 'Resta unidades que se dañaron, regalaron o perdieron.' : 'Escribe cuántas hay de verdad al contarlas; se registra la diferencia.'}
            </Text>
          </View>
          <Field
            label={kind === 'ajuste' ? 'Unidades contadas' : 'Cantidad'}
            value={qty}
            onChangeText={(t) => { setQty(t.replace(/\D/g, '')); touch('qty'); }}
            error={err('qty')}
            keyboardType="number-pad"
            help={qty !== '' ? `Quedará en ${after}.` : undefined}
          />
          <Field label="Motivo" value={reason} onChangeText={(t) => { setReason(t); touch('reason'); }} error={err('reason')} maxLength={100} autoCapitalize="sentences" placeholder="Ej.: conteo del domingo" />
          <AppButton
            label={offline ? 'Sin conexión' : 'Guardar movimiento'}
            icon="content-save-outline"
            loading={save.isPending}
            disabled={!parsed.success || offline}
            onPress={() => parsed.success && save.mutate(parsed.data)}
          />
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
});
