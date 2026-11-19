import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdjustmentInput, fieldErrors } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field } from '@/components/Field';
import { ProductPicker } from '@/components/ProductPicker';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { Card, Chips } from '@/components/ui';
import { useAllProducts, useConnection, useInvalidateStock } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, radius, space, type } from '@/theme';

type Kind = 'entrada' | 'salida' | 'ajuste';
const HELP: Record<Kind, string> = {
  entrada: 'Suma unidades (p. ej. una devolución).',
  salida: 'Resta unidades (p. ej. una botella rota).',
  ajuste: 'Escribe cuántas hay de verdad después de contar.',
};

/** RF-48: ajuste manual con tipo, cantidad y motivo; queda como movimiento (RN-02). */
function Ajuste() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const products = useAllProducts();
  const conn = useConnection();
  const invalidate = useInvalidateStock();
  const [pid, setPid] = useState<number | null>(productId ? Number(productId) : null);
  const [kind, setKind] = useState<Kind>('salida');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);

  const p = products.data?.find((x) => x.id === pid) ?? null;
  const parsed = AdjustmentInput.safeParse({ productId: pid ?? undefined, type: kind, qty, reason });
  const local = parsed.success ? {} : fieldErrors(parsed.error);
  const n = Number(qty);
  const after = p && qty !== '' && Number.isInteger(n) ? (kind === 'entrada' ? p.stock + n : kind === 'salida' ? p.stock - n : n) : null;

  const save = useMutation({
    mutationFn: () => api.adjust(parsed.data!),
    onSuccess: (r) => {
      invalidate();
      Alert.alert('Ajuste registrado', `${p?.name}: ahora hay ${r.stock}.`);
      router.back();
    },
  });
  const server = save.error instanceof ApiError ? { [save.error.field ?? '_']: save.error.message } : {};
  const err = (k: string) => (touched ? (server as Record<string, string>)[k] ?? local[k] : undefined);

  return (
    <Screen
      footer={
        <AppButton
          label={kind === 'entrada' ? 'Registrar entrada' : kind === 'salida' ? 'Registrar salida' : 'Registrar ajuste'}
          icon="check"
          disabled={conn === 'off'}
          loading={save.isPending}
          onPress={() => { setTouched(true); if (parsed.success && after != null && after >= 0) save.mutate(); }}
        />
      }
    >
      <Text style={type.small}>Producto</Text>
      <Pressable onPress={() => setPicking(true)} style={[styles.pick, touched && !pid && { borderColor: colors.red, borderWidth: 2 }]} accessibilityRole="button">
        <Text style={[type.body, { flex: 1 }]}>{p ? p.name : 'Elige un producto'}</Text>
        {p && <Text style={type.small}>Stock {p.stock} · mín. {p.minStock}</Text>}
      </Pressable>
      {touched && err('productId') && <Text style={styles.err}>{err('productId')}</Text>}

      <Chips<Kind> value={kind} onChange={setKind} options={[{ value: 'entrada', label: 'Entrada' }, { value: 'salida', label: 'Salida' }, { value: 'ajuste', label: 'Conteo' }]} />
      <Field label={kind === 'ajuste' ? 'Unidades contadas' : 'Cantidad'} value={qty} onChangeText={setQty} keyboardType="number-pad" help={HELP[kind]} error={err('qty') ?? (touched && after != null && after < 0 ? `Solo hay ${p?.stock}` : undefined)} />
      <Field label="Motivo *" value={reason} onChangeText={setReason} placeholder="Ej. Botella rota durante el turno" multiline maxLength={200} error={err('reason')} />
      {err('_') && <Text style={styles.err}>{err('_')}</Text>}

      {p && after != null && (
        <Card>
          <View style={styles.after}>
            <Text style={type.body}>Stock después del ajuste</Text>
            <Text style={[type.figure, { fontSize: 26 }, after < 0 && { color: colors.red }, after <= p.minStock && after >= 0 && { color: colors.amber }]}>{after}</Text>
          </View>
        </Card>
      )}
      <Text style={type.small}>Queda registrado quién, cuándo y por qué. Para anular un ajuste se hace otro movimiento: nada se borra.</Text>
      <ProductPicker visible={picking} products={products.data ?? []} onClose={() => setPicking(false)} onPick={(x) => { setPid(x.id); setPicking(false); }} />
    </Screen>
  );
}

export default function AjusteScreen() {
  return <RoleGate roles={['dueno']}><Ajuste /></RoleGate>;
}

const styles = StyleSheet.create({
  pick: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.face },
  err: { color: colors.red, fontSize: 13 },
  after: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
});
