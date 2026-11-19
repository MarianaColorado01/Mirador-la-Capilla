import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { fieldErrors, SupplierInput, type Supplier } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field, SwitchRow } from '@/components/Field';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { useInvalidateStock, useSupplier } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { space } from '@/theme';

/** RF-52: registrar o editar proveedor con nombre, teléfono, notas, dirección y coordenadas. */
function SupplierForm({ initial }: { initial: Supplier | null }) {
  const invalidate = useInvalidateStock();
  const [f, setF] = useState({
    name: initial?.name ?? '', phone: initial?.phone ?? '', notes: initial?.notes ?? '', address: initial?.address ?? '',
    lat: initial?.lat != null ? String(initial.lat) : '', lng: initial?.lng != null ? String(initial.lng) : '', active: initial?.active ?? true,
  });
  const [touched, setTouched] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const parsed = SupplierInput.safeParse(f);
  const local = parsed.success ? {} : fieldErrors(parsed.error);
  const save = useMutation({
    mutationFn: () => (initial ? api.updateSupplier(initial.id, parsed.data!) : api.createSupplier(parsed.data!)),
    onSuccess: () => { invalidate(); router.back(); },
    onError: (e) => { if (!(e instanceof ApiError && e.field)) Alert.alert('No se pudo guardar', (e as Error).message); },
  });
  const server = save.error instanceof ApiError && save.error.field ? { [save.error.field]: save.error.message } : {};
  const err = (k: string) => (touched ? (server as Record<string, string>)[k] ?? local[k] : undefined);

  // Atajo: usar la ubicación actual del celular (útil si se registra estando en la bodega del proveedor).
  const useHere = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Sin permiso de ubicación', 'Escribe las coordenadas a mano.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setF((s) => ({ ...s, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
    } catch {
      Alert.alert('No se pudo obtener la ubicación', 'Revisa que el GPS esté encendido.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Screen footer={<AppButton label={initial ? 'Guardar cambios' : 'Guardar proveedor'} icon="content-save-outline" loading={save.isPending} onPress={() => { setTouched(true); if (parsed.success) save.mutate(); }} />}>
      <Stack.Screen options={{ title: initial ? 'Editar proveedor' : 'Nuevo proveedor' }} />
      <Field label="Nombre *" value={f.name} onChangeText={set('name')} error={err('name')} maxLength={60} />
      <Field label="Teléfono" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={30} />
      <Field label="Dirección" value={f.address} onChangeText={set('address')} maxLength={120} />
      <Field label="Notas" value={f.notes} onChangeText={set('notes')} placeholder="Ej. entrega martes y viernes" multiline maxLength={200} />
      <View style={styles.two}>
        <Field flex={1} label="Latitud" value={f.lat} onChangeText={set('lat')} keyboardType="numbers-and-punctuation" error={err('lat')} placeholder="4.9958" />
        <Field flex={1} label="Longitud" value={f.lng} onChangeText={set('lng')} keyboardType="numbers-and-punctuation" error={err('lng')} placeholder="-75.8121" />
      </View>
      <AppButton label="Usar mi ubicación actual" icon="crosshairs-gps" variant="text" compact loading={locating} onPress={useHere} />
      <SwitchRow label="Proveedor activo" help="Los inactivos no aparecen al registrar compras ni en el mapa." value={f.active} onChange={set('active')} />
    </Screen>
  );
}

export default function ProveedorEditar() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sup = useSupplier(Number(id));
  return (
    <RoleGate roles={['dueno']}>
      {!id ? (
        <SupplierForm initial={null} />
      ) : sup.isPending ? (
        <Screen><StateView kind="loading" /></Screen>
      ) : sup.isError ? (
        <Screen><StateView kind="error" message={(sup.error as Error).message} onRetry={() => sup.refetch()} /></Screen>
      ) : (
        <SupplierForm initial={sup.data} />
      )}
    </RoleGate>
  );
}

const styles = StyleSheet.create({ two: { flexDirection: 'row', gap: space.md } });
