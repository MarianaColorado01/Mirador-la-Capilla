import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { fieldErrors, PurchaseInput } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field } from '@/components/Field';
import { ProductPicker } from '@/components/ProductPicker';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips } from '@/components/ui';
import { useAllProducts, useConnection, useInvalidateStock, useSuggestions, useSuppliers } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';
import { isoDate, money } from '@/utils/format';

interface Line { productId: number; name: string; qty: string; unitCost: string; stock: number }

/** RF-53 / RF-54: compra de surtido con proveedor, fecha e ítems; al guardar sube el stock y actualiza el costo. */
function NuevaCompra() {
  const params = useLocalSearchParams<{ supplierId?: string; sugerencias?: string }>();
  const suppliers = useSuppliers();
  const products = useAllProducts();
  const suggestions = useSuggestions();
  const conn = useConnection();
  const invalidate = useInvalidateStock();

  const [supplierId, setSupplierId] = useState(params.supplierId ?? '');
  const [date, setDate] = useState(isoDate());
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);

  // «Crear compra con esto» desde Inventario: precarga las sugerencias una sola vez.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || params.sugerencias !== '1' || !suggestions.data || !products.data) return;
    prefilled.current = true;
    const next = suggestions.data.flatMap((s) => {
      const p = products.data.find((x) => x.id === s.productId);
      return p ? [{ productId: p.id, name: p.name, qty: String(s.suggestedQty), unitCost: String(p.cost), stock: p.stock }] : [];
    });
    const first = suggestions.data.find((s) => s.supplierId)?.supplierId;
    // Se aplica en el siguiente ciclo para no encadenar renders dentro del efecto.
    queueMicrotask(() => {
      setLines(next);
      if (first) setSupplierId((cur) => cur || String(first));
    });
  }, [params.sugerencias, suggestions.data, products.data]);

  const body = { supplierId: supplierId || undefined, date, items: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })) };
  const parsed = PurchaseInput.safeParse(body);
  const local = parsed.success ? {} : fieldErrors(parsed.error);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const save = useMutation({
    mutationFn: () => api.createPurchase(parsed.data!),
    onSuccess: (p) => {
      invalidate();
      Alert.alert('Compra registrada', `${p.items.length} ${p.items.length === 1 ? 'producto' : 'productos'} · ${money(p.total)}. El stock y el costo ya se actualizaron.`);
      router.back();
    },
    onError: (e) => { if (!(e instanceof ApiError && e.field)) Alert.alert('No se pudo guardar', (e as Error).message); },
  });
  const server = save.error instanceof ApiError && save.error.field ? { [save.error.field]: save.error.message } : {};
  const err = (k: string) => (touched ? (server as Record<string, string>)[k] ?? local[k] : undefined);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  if (suppliers.isPending || products.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (suppliers.isError || products.isError) {
    return <Screen><StateView kind="error" message={((suppliers.error ?? products.error) as Error).message} onRetry={() => { suppliers.refetch(); products.refetch(); }} /></Screen>;
  }

  return (
    <Screen
      footer={
        <>
          <View style={styles.totalRow}>
            <Text style={type.label}>Total de la compra</Text>
            <Text style={[type.figure, { fontSize: 24 }]}>{money(total)}</Text>
          </View>
          <AppButton label="Guardar compra y subir stock" icon="check" disabled={conn === 'off'} loading={save.isPending} onPress={() => { setTouched(true); if (parsed.success) save.mutate(); }} />
        </>
      }
    >
      <Text style={type.small}>Proveedor *</Text>
      {suppliers.data.length === 0 ? (
        <Banner tone="amber" icon="truck-outline" title="No hay proveedores activos" text="Agrega uno en Proveedores." />
      ) : (
        <Chips value={supplierId} onChange={setSupplierId} options={suppliers.data.map((s) => ({ value: String(s.id), label: s.name }))} />
      )}
      {err('supplierId') && <Text style={styles.err}>{err('supplierId')}</Text>}
      <Field label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={err('date')} />

      <Card title={`Productos · ${lines.length}`}>
        {lines.length === 0 && <Text style={[type.small, { padding: space.lg }]}>Agrega los productos que llegaron.</Text>}
        {lines.map((l, i) => {
          const lineTotal = (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
          return (
            <View key={`${l.productId}-${i}`} style={styles.line}>
              <View style={styles.lineHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '600' }]}>{l.name}</Text>
                  <Text style={type.small}>Stock actual {l.stock}{Number(l.qty) > 0 ? ` → ${l.stock + (Number(l.qty) || 0)}` : ''}</Text>
                </View>
                <Pressable onPress={() => setLines((ls) => ls.filter((_, k) => k !== i))} accessibilityLabel={`Quitar ${l.name}`} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.ink3} />
                </Pressable>
              </View>
              <View style={styles.two}>
                <Field flex={1} label="Cantidad" value={l.qty} onChangeText={(t) => setLine(i, { qty: t })} keyboardType="number-pad" error={err(`items.${i}.qty`)} />
                <Field flex={1} label="Costo unitario" value={l.unitCost} onChangeText={(t) => setLine(i, { unitCost: t })} keyboardType="number-pad" error={err(`items.${i}.unitCost`)} />
              </View>
              <Text style={[type.small, { textAlign: 'right' }]}>Total del ítem: <Text style={{ color: colors.ink, fontWeight: '700' }}>{money(lineTotal)}</Text></Text>
            </View>
          );
        })}
        <View style={{ padding: space.md }}>
          <AppButton label="Agregar producto" icon="plus" variant="outline" compact onPress={() => setPicking(true)} />
        </View>
      </Card>
      {err('items') && <Text style={styles.err}>{err('items')}</Text>}
      <Banner tone="neutral" icon="information-outline" title="Al guardar" text="Se registra una entrada de stock por cada producto y se actualiza su último costo. Las ventas anteriores conservan el costo con que se vendieron." />

      <ProductPicker
        visible={picking}
        products={products.data}
        onClose={() => setPicking(false)}
        onPick={(p) => {
          setPicking(false);
          setLines((ls) => [...ls, { productId: p.id, name: p.name, qty: '', unitCost: String(p.cost), stock: p.stock }]);
        }}
      />
    </Screen>
  );
}

export default function NuevaCompraScreen() {
  return <RoleGate roles={['dueno']}><NuevaCompra /></RoleGate>;
}

const styles = StyleSheet.create({
  err: { color: colors.red, fontSize: 13 },
  two: { flexDirection: 'row', gap: space.md },
  line: { padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line2 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
