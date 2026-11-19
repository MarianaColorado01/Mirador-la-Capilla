import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { fieldErrors, ProductInput, type ProductOwnerView } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field, SwitchRow } from '@/components/Field';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Chips } from '@/components/ui';
import { useCategories, useInvalidateStock, useProduct } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { space, type } from '@/theme';
import { money } from '@/utils/format';

/** Formulario controlado: crea o edita. Valida con el mismo esquema que el servidor (RF-13, RF-14). */
function ProductForm({ initial }: { initial: ProductOwnerView | null }) {
  const categories = useCategories();
  const invalidate = useInvalidateStock();
  const [name, setName] = useState(initial?.name ?? '');
  const [categoryId, setCategoryId] = useState(initial ? String(initial.categoryId) : '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [cost, setCost] = useState(initial ? String(initial.cost) : '');
  const [minStock, setMinStock] = useState(initial ? String(initial.minStock) : '0');
  const [active, setActive] = useState(initial?.active ?? true);
  const [touched, setTouched] = useState(false);

  const parsed = ProductInput.safeParse({ name, categoryId: categoryId || undefined, price, cost, minStock, active });
  const local = parsed.success ? {} : fieldErrors(parsed.error);

  const save = useMutation({
    mutationFn: () => (initial ? api.updateProduct(initial.id, parsed.data!) : api.createProduct(parsed.data!)),
    onSuccess: (p) => {
      invalidate();
      if (initial) router.back();
      else router.replace({ pathname: '/producto/[id]', params: { id: String(p.id) } });
    },
    onError: (e) => { if (!(e instanceof ApiError && e.field)) Alert.alert('No se pudo guardar', (e as Error).message); },
  });
  const server = save.error instanceof ApiError && save.error.field ? { [save.error.field]: save.error.message } : {};
  const err = (k: string) => (touched ? (server as Record<string, string>)[k] ?? local[k] : undefined);
  const margin = Number(price) - Number(cost);

  return (
    <Screen
      footer={
        <AppButton
          label={initial ? 'Guardar cambios' : 'Crear producto'}
          icon="content-save-outline"
          loading={save.isPending}
          onPress={() => { setTouched(true); if (parsed.success) save.mutate(); }}
        />
      }
    >
      <Stack.Screen options={{ title: initial ? 'Editar producto' : 'Nuevo producto' }} />
      <Field label="Nombre *" value={name} onChangeText={setName} error={err('name')} maxLength={60} />
      <View style={{ gap: 6 }}>
        <Text style={type.small}>Categoría *</Text>
        {categories.isPending ? (
          <StateView kind="loading" />
        ) : (
          <Chips value={categoryId} onChange={setCategoryId} options={(categories.data ?? []).filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name }))} />
        )}
        {err('categoryId') && <Text style={{ color: '#FF6B63', fontSize: 13 }}>{err('categoryId')}</Text>}
      </View>
      <View style={styles.two}>
        <Field flex={1} label="Precio de venta *" value={price} onChangeText={setPrice} keyboardType="number-pad" error={err('price')} />
        <Field flex={1} label="Costo *" value={cost} onChangeText={setCost} keyboardType="number-pad" error={err('cost')} help="Se actualiza al registrar compras" />
      </View>
      {Number.isFinite(margin) && Number(price) > 0 && Number(cost) > 0 && (
        <Text style={type.small}>Margen por unidad: {money(margin)}{margin < 0 ? ' · ¡el costo supera el precio!' : ''}</Text>
      )}
      <Field label="Stock mínimo" value={minStock} onChangeText={setMinStock} keyboardType="number-pad" error={err('minStock')} help="Avisa cuando el stock llegue a este número" />
      <SwitchRow label="Producto activo" help="Si lo desactivas no se borra: deja de aparecer al tomar pedidos." value={active} onChange={setActive} />
      <Banner tone="neutral" icon="information-outline" title="El stock no se edita aquí" text="Usa Registrar compra o Ajustar stock: el número solo cambia con movimientos." />
    </Screen>
  );
}

export default function ProductoEditar() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pid = Number(id);
  const product = useProduct(pid);
  return (
    <RoleGate roles={['dueno']}>
      {!id ? (
        <ProductForm initial={null} />
      ) : product.isPending ? (
        <Screen><StateView kind="loading" /></Screen>
      ) : product.isError ? (
        <Screen><StateView kind="error" message={(product.error as Error).message} onRetry={() => product.refetch()} /></Screen>
      ) : (
        <ProductForm initial={product.data as ProductOwnerView} />
      )}
    </RoleGate>
  );
}

const styles = StyleSheet.create({ two: { flexDirection: 'row', gap: space.md } });
