import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { fieldErrors, ProductSchema, ProductUpdateSchema, type Category } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Field } from '@/components/ui';
import { keys, useCategories, useConnection, useProduct } from '@/hooks/queries';
import { api, ApiError, type ProductBody } from '@/services/api';
import type { ProductModel } from '@/services/mappers';
import { colors, space, type } from '@/theme';

// Vacío no es 0: el esquema lo marca como «Escribe un número».
const toNumber = (t: string) => (t.trim() === '' ? NaN : Number(t.trim()));

/** RF-13 / RF-14: crear (sin ?id) o editar (?id=) un producto. Solo el dueño. */
export default function EditarProducto() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const productId = id ? Number(id) : null;
  const product = useProduct(productId ?? NaN);
  const categories = useCategories();

  const failed = categories.error ?? (productId !== null ? product.error : null);
  const ready = categories.data && (productId === null || product.data);
  return (
    <Screen>
      <Stack.Screen options={{ title: productId ? 'Editar producto' : 'Nuevo producto' }} />
      {productId !== null && (!Number.isInteger(productId) || (failed instanceof ApiError && failed.status === 404)) ? (
        <StateView kind="empty" icon="bottle-wine-outline" title="Producto no encontrado" action={{ label: 'Volver', onPress: () => router.back() }} />
      ) : failed ? (
        <StateView kind="error" message={failed.message} onRetry={() => { categories.refetch(); product.refetch(); }} />
      ) : !ready ? (
        <StateView kind="loading" />
      ) : (
        <ProductForm product={product.data ?? null} categories={categories.data.filter((c) => c.active || c.id === product.data?.categoryId)} />
      )}
    </Screen>
  );
}

function ProductForm({ product, categories }: { product: ProductModel | null; categories: Category[] }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [form, setForm] = useState({
    name: product?.name ?? '',
    categoryId: product?.categoryId ?? 0,
    price: product ? String(product.price) : '',
    cost: product?.cost != null ? String(product.cost) : '',
    minStock: product ? String(product.minStock) : '0',
    imageUrl: product?.imageUrl ?? '',
  });
  // Un campo vacío recién abierto no se marca en rojo hasta que lo toquen.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: (body: Partial<ProductBody & { active: boolean }>) =>
      product ? api.updateProduct(product.id, body) : api.createProduct(body as ProductBody),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: keys.products });
      if (product) return router.back();
      router.replace(`/producto/${p.id}`);
    },
  });

  const values = { ...form, price: toNumber(form.price), cost: toNumber(form.cost), minStock: toNumber(form.minStock) };
  const parsed = (product ? ProductUpdateSchema : ProductSchema).safeParse(values);
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  const err = (k: keyof typeof form) => (touched[k] || product || serverErr?.field === k ? errors[k] : undefined);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
    save.reset();
  };

  const toggleActive = () => {
    if (!product) return;
    if (!product.active) return save.mutate({ active: true });
    Alert.alert(`¿Desactivar ${product.name}?`, 'Deja de aparecer al tomar pedidos. Su historial se conserva y puedes reactivarlo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: () => save.mutate({ active: false }) },
    ]);
  };

  return (
    <>
      {serverErr && (!serverErr.field || serverErr.field === 'active') && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
      <Card title={product ? `Editar · ${product.name}` : 'Nuevo producto'}>
        <View style={styles.body}>
          <Field label="Nombre" value={form.name} onChangeText={set('name')} error={err('name')} maxLength={60} autoCapitalize="sentences" />
          <View style={{ gap: 6 }}>
            <Text style={type.label}>Categoría</Text>
            <Chips options={categories.map((c) => ({ value: String(c.id), label: c.name }))} value={String(form.categoryId)} onChange={(v) => set('categoryId')(Number(v))} />
            {(touched.categoryId || serverErr?.field === 'categoryId') && errors.categoryId && <Text style={styles.err}>{errors.categoryId}</Text>}
            {categories.length === 0 && <Text style={type.small}>Crea primero una categoría en «Categorías».</Text>}
          </View>
          <View style={styles.row}>
            <Field half label="Precio de venta" value={form.price} onChangeText={(t) => set('price')(t.replace(/\D/g, ''))} error={err('price')} keyboardType="number-pad" />
            <Field half label="Costo" value={form.cost} onChangeText={(t) => set('cost')(t.replace(/\D/g, ''))} error={err('cost')} keyboardType="number-pad" />
          </View>
          <Field label="Stock mínimo" value={form.minStock} onChangeText={(t) => set('minStock')(t.replace(/\D/g, ''))} error={err('minStock')} keyboardType="number-pad" help="Por debajo de este número se avisa que quedan pocas." />
          <Field
            label="Imagen (opcional)"
            value={form.imageUrl}
            onChangeText={set('imageUrl')}
            error={err('imageUrl')}
            help="Dirección https:// de la foto. Sin imagen se muestra un ícono."
            autoCapitalize="none"
            keyboardType="url"
          />
          {!product && <Banner tone="neutral" icon="information-outline" title="El stock empieza en 0" text="Se carga con una compra o un ajuste de inventario." />}
          <AppButton
            label={offline ? 'Sin conexión' : product ? 'Guardar cambios' : 'Crear producto'}
            icon="content-save-outline"
            loading={save.isPending}
            disabled={!parsed.success || offline}
            onPress={() => parsed.success && save.mutate(parsed.data as ProductBody)}
          />
          {product && (
            <AppButton
              label={product.active ? 'Desactivar' : 'Reactivar'}
              icon={product.active ? 'eye-off-outline' : 'eye-outline'}
              variant={product.active ? 'danger' : 'outline'}
              disabled={offline || save.isPending}
              onPress={toggleActive}
            />
          )}
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  err: { color: colors.red, fontSize: 13 },
});
