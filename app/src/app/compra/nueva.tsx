import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fieldErrors, localDate, PurchaseItemSchema, PurchaseSchema, type Supplier } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Field, MoneyRow } from '@/components/ui';
import { keys, useAllProducts, useConnection, useStockSuggestions, useSuppliers } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import type { ProductModel } from '@/services/mappers';
import { colors, radius, space, type } from '@/theme';
import { money } from '@/utils/format';

type Line = { productId: number; name: string; qty: string; unitCost: string };

// Vacío no es 0: el esquema lo marca como «Escribe un número».
const toNumber = (t: string) => (t.trim() === '' ? NaN : Number(t.trim()));

/**
 * RF-53 / RF-54: registrar una compra (solo el dueño). ?supplierId= preselecciona el proveedor y
 * ?surtir=1 arranca con lo sugerido en «Qué surtir» (RF-51), al último costo de cada producto.
 */
export default function NuevaCompra() {
  const { supplierId, surtir } = useLocalSearchParams<{ supplierId?: string; surtir?: string }>();
  const suppliers = useSuppliers();
  const products = useAllProducts();
  const suggestions = useStockSuggestions();
  const withSuggestions = surtir === '1';

  const failed = suppliers.error ?? products.error ?? (withSuggestions ? suggestions.error : null);
  const ready = suppliers.data && products.data && (!withSuggestions || suggestions.data);
  if (failed && !ready)
    return <Screen><StateView kind="error" message={failed.message} onRetry={() => { suppliers.refetch(); products.refetch(); suggestions.refetch(); }} /></Screen>;
  if (!ready) return <Screen><StateView kind="loading" /></Screen>;

  const active = suppliers.data!.filter((s) => s.active);
  if (active.length === 0)
    return (
      <Screen>
        <StateView kind="empty" icon="truck-outline" title="No hay proveedores activos" message="Crea o reactiva un proveedor para registrar la compra." action={{ label: 'Ir a proveedores', onPress: () => router.replace('/proveedores') }} />
      </Screen>
    );

  const catalog = products.data!.filter((p) => p.active);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const initial: Line[] = withSuggestions
    ? suggestions.data!.flatMap((s) => {
        const p = byId.get(s.productId);
        return p ? [{ productId: p.id, name: p.name, qty: String(s.suggested), unitCost: String(p.cost ?? '') }] : [];
      })
    : [];
  const preset = active.find((s) => s.id === Number(supplierId))?.id ?? (active.length === 1 ? active[0].id : 0);
  return <PurchaseForm suppliers={active} catalog={catalog} initial={initial} supplierId={preset} />;
}

function PurchaseForm({ suppliers, catalog, initial, supplierId }: { suppliers: Supplier[]; catalog: ProductModel[]; initial: Line[]; supplierId: number }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [supplier, setSupplier] = useState(supplierId);
  const [date, setDate] = useState(localDate());
  const [lines, setLines] = useState<Line[]>(initial);
  const [q, setQ] = useState('');
  // Un campo vacío recién agregado no se marca en rojo hasta que lo toquen.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: api.createPurchase,
    onSuccess: (p) => {
      // El stock y el último costo cambiaron: productos, inventario y «Qué surtir» cuelgan de ['products'].
      qc.invalidateQueries({ queryKey: keys.products });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      router.replace({ pathname: '/compra/[id]', params: { id: String(p.id), fresh: '1' } });
    },
  });
  const serverErr = save.error instanceof ApiError ? save.error : null;
  const edited = () => save.reset();

  const items = lines.map((l) => ({ productId: l.productId, qty: toNumber(l.qty), unitCost: toNumber(l.unitCost) }));
  const parsed = PurchaseSchema.safeParse({ supplierId: supplier, date, items });
  const errors = fieldErrors(parsed.error);
  if (serverErr?.field && !serverErr.field.startsWith('items.') && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  // El servidor marca un ítem como «items.<n>.<campo>».
  const serverItem = serverErr?.field?.match(/^items\.(\d+)\.(\w+)$/);
  const lineErrors = items.map((it, n) => {
    const e = fieldErrors(PurchaseItemSchema.safeParse(it).error);
    if (serverItem && Number(serverItem[1]) === n) e[serverItem[2]] ??= serverErr!.message;
    return e;
  });
  const total = items.reduce((t, i) => t + (Number.isFinite(i.qty * i.unitCost) ? i.qty * i.unitCost : 0), 0);

  const setLine = (n: number, k: 'qty' | 'unitCost') => (t: string) => {
    setLines((ls) => ls.map((l, i) => (i === n ? { ...l, [k]: t.replace(/\D/g, '') } : l)));
    setTouched((x) => ({ ...x, [`${lines[n].productId}.${k}`]: true }));
    edited();
  };
  const remove = (n: number) => { setLines((ls) => ls.filter((_, i) => i !== n)); edited(); };
  const add = (p: ProductModel) => {
    setLines((ls) => [...ls, { productId: p.id, name: p.name, qty: '', unitCost: p.cost != null ? String(p.cost) : '' }]);
    setQ('');
    edited();
  };
  const err = (n: number, k: 'qty' | 'unitCost' | 'productId') =>
    touched[`${lines[n].productId}.${k}`] || (serverItem && Number(serverItem[1]) === n) ? lineErrors[n][k] : undefined;

  const term = q.trim().toLowerCase();
  const inList = new Set(lines.map((l) => l.productId));
  const matches = term ? catalog.filter((p) => !inList.has(p.id) && p.name.toLowerCase().includes(term)).slice(0, 6) : [];

  return (
    <Screen
      footer={
        <>
          <MoneyRow label="Total compra" value={total} strong />
          <AppButton
            label={offline ? 'Sin conexión' : 'Guardar compra'}
            icon="content-save-outline"
            loading={save.isPending}
            disabled={!parsed.success || offline}
            onPress={() => parsed.success && save.mutate(parsed.data)}
          />
        </>
      }
    >
      {serverErr && !serverErr.field && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
      <Card title="Proveedor y fecha">
        <View style={styles.body}>
          <View style={{ gap: 6 }}>
            <Text style={type.label}>Proveedor</Text>
            <Chips options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))} value={String(supplier)} onChange={(v) => { setSupplier(Number(v)); edited(); }} />
            {(touched.supplierId || serverErr?.field === 'supplierId') && errors.supplierId && <Text style={styles.err}>{errors.supplierId}</Text>}
            {!supplier && <Text style={type.small}>Toca el proveedor que trajo la mercancía.</Text>}
          </View>
          <Field
            label="Fecha (AAAA-MM-DD)"
            value={date}
            onChangeText={(t) => { setDate(t.trim()); setTouched((x) => ({ ...x, date: true })); edited(); }}
            error={touched.date || serverErr?.field === 'date' ? errors.date : undefined}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            help="Hoy por defecto. No puede ser una fecha futura."
          />
        </View>
      </Card>

      <Card title={`Productos · ${lines.length}`}>
        {lines.length === 0 && <Text style={[type.small, styles.pad]}>Agrega al menos un producto con el buscador de abajo.</Text>}
        {lines.map((l, n) => {
          const it = items[n];
          const lineTotal = it.qty * it.unitCost;
          return (
            <View key={l.productId} style={styles.line}>
              <View style={styles.lineHead}>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.lineTotal}>{Number.isFinite(lineTotal) ? money(lineTotal) : '—'}</Text>
                <Pressable onPress={() => remove(n)} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Quitar ${l.name}`} hitSlop={6}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.ink3} />
                </Pressable>
              </View>
              {err(n, 'productId') && <Text style={styles.err}>{err(n, 'productId')}</Text>}
              <View style={styles.row}>
                <Field half label="Cantidad" value={l.qty} onChangeText={setLine(n, 'qty')} error={err(n, 'qty')} keyboardType="number-pad" accessibilityLabel={`Cantidad de ${l.name}`} />
                <Field half label="Costo unitario" value={l.unitCost} onChangeText={setLine(n, 'unitCost')} error={err(n, 'unitCost')} keyboardType="number-pad" accessibilityLabel={`Costo unitario de ${l.name}`} />
              </View>
            </View>
          );
        })}
        <View style={[styles.pad, { gap: space.sm }]}>
          <View style={styles.search}>
            <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
            <TextInput value={q} onChangeText={setQ} placeholder="Agregar producto…" placeholderTextColor={colors.ink3} style={styles.searchInput} accessibilityLabel="Buscar producto para agregar" />
          </View>
          {term !== '' && matches.length === 0 && <Text style={type.small}>Ningún producto activo coincide (o ya está en la compra).</Text>}
          {matches.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => add(p)}
              style={({ pressed }) => [styles.match, pressed && { backgroundColor: colors.face2 }]}
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${p.name}, hay ${p.stock}`}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.ink2} />
              <Text style={[styles.name, { flex: 1 }]}>{p.name}</Text>
              <Text style={type.small}>Hay {p.stock}{p.cost != null ? ` · último costo ${money(p.cost)}` : ''}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Text style={type.small}>Al guardar, cada producto sube su stock y su costo pasa a ser el de esta compra. Lo ya vendido conserva su costo.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  pad: { padding: 14 },
  row: { flexDirection: 'row', gap: space.md },
  line: { paddingHorizontal: 14, paddingVertical: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line2 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' },
  lineTotal: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.red, fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 6, borderRadius: radius.md },
});
