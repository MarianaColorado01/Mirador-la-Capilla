import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { fieldErrors, SupplierSchema, type Supplier } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Field } from '@/components/ui';
import { keys, useConnection, useSupplier } from '@/hooks/queries';
import { api, ApiError, type SupplierBody } from '@/services/api';
import { space } from '@/theme';

// Coordenada vacía = sin ubicación; texto que no es número → NaN y el esquema dice «Escribe un número».
const toCoord = (t: string) => (t.trim() === '' ? null : Number(t.trim().replace(',', '.')));

/** RF-52: detalle y edición de un proveedor (/proveedor/nuevo para crear). Solo el dueño. */
export default function ProveedorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nuevo';
  const supplier = useSupplier(isNew ? NaN : Number(id));
  const notFound = !isNew && (!(Number(id) > 0) || (supplier.error instanceof ApiError && supplier.error.status === 404));
  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Nuevo proveedor' : (supplier.data?.name ?? 'Proveedor') }} />
      {notFound ? (
        <StateView kind="empty" icon="truck-outline" title="Proveedor no encontrado" action={{ label: 'Volver', onPress: () => router.back() }} />
      ) : isNew ? (
        <SupplierForm supplier={null} />
      ) : supplier.isPending ? (
        <StateView kind="loading" />
      ) : supplier.isError ? (
        <StateView kind="error" message={supplier.error.message} onRetry={() => supplier.refetch()} />
      ) : (
        <SupplierForm supplier={supplier.data} />
      )}
    </Screen>
  );
}

function SupplierForm({ supplier }: { supplier: Supplier | null }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
    lat: supplier?.lat != null ? String(supplier.lat) : '',
    lng: supplier?.lng != null ? String(supplier.lng) : '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: (body: Partial<SupplierBody & { active: boolean }>) =>
      supplier ? api.updateSupplier(supplier.id, body) : api.createSupplier(body as SupplierBody),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: keys.suppliers });
      if (supplier) return;
      router.replace({ pathname: '/proveedor/[id]', params: { id: String(s.id) } });
    },
  });

  // Se manda el formulario completo también al editar: así latitud y longitud siempre viajan juntas.
  const parsed = SupplierSchema.safeParse({ ...form, lat: toCoord(form.lat), lng: toCoord(form.lng) });
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  const err = (k: keyof typeof form) => (touched[k] || supplier || serverErr?.field === k ? errors[k] : undefined);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
    save.reset();
  };

  const toggleActive = () => {
    if (!supplier) return;
    if (!supplier.active) return save.mutate({ active: true });
    Alert.alert(`¿Desactivar ${supplier.name}?`, 'No se podrán registrar compras a su nombre. Sus compras se conservan y puedes reactivarlo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: () => save.mutate({ active: false }) },
    ]);
  };

  return (
    <>
      {serverErr && (!serverErr.field || serverErr.field === 'active') && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
      {save.isSuccess && supplier && <Banner tone="green" icon="check-circle-outline" title="Cambios guardados" />}
      {supplier && !supplier.active && <Banner tone="amber" icon="eye-off-outline" title="Proveedor inactivo" text="Reactívalo para registrarle compras." />}
      {supplier && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppButton
              label="Ver compras"
              icon="receipt"
              variant="outline"
              onPress={() => router.push({ pathname: '/compras', params: { supplierId: String(supplier.id) } })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              label="Nueva compra"
              icon="cart-plus"
              disabled={!supplier.active}
              onPress={() => router.push({ pathname: '/compra/nueva', params: { supplierId: String(supplier.id) } })}
            />
          </View>
        </View>
      )}
      {/* RF-66: solo si tiene coordenadas; el mapa centra en él sin trazar ruta. Se oculta si está inactivo porque el mapa solo muestra activos. */}
      {supplier?.active && supplier.lat != null && supplier.lng != null && (
        <AppButton
          label="Ver en el mapa"
          icon="map-marker-outline"
          variant="outline"
          onPress={() => router.push({ pathname: '/ubicacion', params: { supplierId: String(supplier.id) } })}
        />
      )}
      <Card title={supplier ? 'Datos del proveedor' : 'Nuevo proveedor'}>
        <View style={styles.body}>
          <Field label="Nombre" value={form.name} onChangeText={set('name')} error={err('name')} maxLength={60} autoCapitalize="words" />
          <Field label="Teléfono (opcional)" value={form.phone} onChangeText={set('phone')} error={err('phone')} maxLength={20} keyboardType="phone-pad" />
          <Field label="Dirección (opcional)" value={form.address} onChangeText={set('address')} error={err('address')} maxLength={120} autoCapitalize="sentences" />
          <Field label="Notas (opcional)" value={form.notes} onChangeText={set('notes')} error={err('notes')} maxLength={200} multiline placeholder="Ej.: entrega martes y viernes" />
          <View style={styles.row}>
            <Field half label="Latitud" value={form.lat} onChangeText={set('lat')} error={err('lat')} keyboardType="numbers-and-punctuation" placeholder="4.99" />
            <Field half label="Longitud" value={form.lng} onChangeText={set('lng')} error={err('lng')} keyboardType="numbers-and-punctuation" placeholder="-75.81" />
          </View>
          <Banner tone="neutral" icon="map-marker-outline" title="Ubicación opcional" text="Escribe las dos coordenadas o deja las dos vacías. Sirven para verlo en el mapa." />
          <AppButton
            label={offline ? 'Sin conexión' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
            icon="content-save-outline"
            loading={save.isPending}
            disabled={!parsed.success || offline}
            onPress={() => parsed.success && save.mutate(parsed.data)}
          />
          {supplier && (
            <AppButton
              label={supplier.active ? 'Desactivar' : 'Reactivar'}
              icon={supplier.active ? 'eye-off-outline' : 'eye-outline'}
              variant={supplier.active ? 'danger' : 'outline'}
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
});
