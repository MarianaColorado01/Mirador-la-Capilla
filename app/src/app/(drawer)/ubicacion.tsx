import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { LeafletMap, MARKER, type MapFocus, type MapPlace } from '@/components/LeafletMap';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card } from '@/components/ui';
import { useSettings, useSupplierLocations } from '@/hooks/queries';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { colors, space, type } from '@/theme';

const coord = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/**
 * RF-61 a RF-66: mapa del bar, los proveedores y el celular. Todos los roles.
 * `supplierId` (desde el detalle de un proveedor, RF-66) centra el mapa en ese proveedor; no se
 * traza ninguna línea entre el bar y él, porque una recta no es una ruta real.
 */
export default function UbicacionScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId?: string }>();
  const settings = useSettings();
  const suppliers = useSupplierLocations();
  const loc = useLocationTracking();
  // El centrado manual vale solo para el proveedor con el que se abrió: otro «Ver en el mapa» manda de nuevo.
  const [manual, setManual] = useState<{ for?: string; focus: MapFocus } | null>(null);

  const places = useMemo<MapPlace[]>(() => {
    const st = settings.data;
    return [
      ...(st ? [{ key: 'bar', kind: 'bar' as const, name: st.businessName, lat: st.barLat, lng: st.barLng }] : []),
      ...(suppliers.data ?? []).map((s) => ({ key: `p${s.id}`, kind: 'supplier' as const, name: s.name, lat: s.lat, lng: s.lng })),
    ];
  }, [settings.data, suppliers.data]);
  const bar = places.find((p) => p.kind === 'bar');
  const target = supplierId ? places.find((p) => p.key === `p${supplierId}`) : undefined;
  // Memo: un objeto nuevo en cada render volvería a centrar el mapa sin que nadie lo pida.
  const initial = useMemo<MapFocus | null>(() => {
    const t = places.find((p) => p.key === `p${supplierId}`) ?? places.find((p) => p.kind === 'bar');
    return t ? { lat: t.lat, lng: t.lng, zoom: t.kind === 'bar' ? 15 : 16, key: t.key } : null;
  }, [places, supplierId]);
  const focus = manual && manual.for === supplierId ? manual.focus : initial;
  const center = (f: MapFocus) => setManual({ for: supplierId, focus: f });

  const myLocation = async () => {
    const p = await loc.locate();
    if (p) center({ lat: p.lat, lng: p.lng, zoom: 17 });
  };

  const ready = loc.status === 'granted';
  return (
    <Screen refreshing={settings.isRefetching || suppliers.isRefetching} onRefresh={() => { settings.refetch(); suppliers.refetch(); }}>
      <PermissionBanner loc={loc} />
      {supplierId && suppliers.isSuccess && !target && (
        <Banner tone="amber" icon="map-marker-question-outline" title="Ese proveedor no tiene ubicación" text="Agrega su latitud y longitud en su ficha para verlo aquí." />
      )}

      <Card>
        {settings.isPending ? (
          <StateView kind="loading" message="Cargando la ubicación del bar…" />
        ) : settings.isError ? (
          <StateView kind="error" message={settings.error.message} onRetry={() => settings.refetch()} />
        ) : (
          <LeafletMap places={places} device={loc.position} focus={focus} />
        )}
      </Card>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppButton label="Mi ubicación" icon="crosshairs-gps" loading={loc.locating} disabled={!ready} onPress={myLocation} />
        </View>
        <View style={{ flex: 1 }}>
          {loc.tracking === 'on' ? (
            <AppButton label="Pausar" icon="pause" variant="outline" onPress={loc.pause} />
          ) : (
            <AppButton label={loc.tracking === 'paused' ? 'Reanudar' : 'Seguirme'} icon="play" variant="outline" disabled={!ready} onPress={loc.start} />
          )}
        </View>
      </View>
      <Text style={type.small} accessibilityLiveRegion="polite">
        {{ on: 'Seguimiento activo: tu marcador se mueve solo.', paused: 'Seguimiento en pausa: el GPS no se está usando.', off: 'Seguimiento apagado.' }[loc.tracking]}
      </Text>

      <View style={styles.legend} accessibilityLabel="Leyenda: cuadrado amarillo el bar, rombo naranja los proveedores, círculo azul tu posición">
        <Legend shape={styles.square} color={MARKER.bar} label="Bar" />
        <Legend shape={styles.diamond} color={MARKER.supplier} label="Proveedor" />
        <Legend shape={styles.circle} color={MARKER.device} label="Tu posición" />
      </View>

      <Card title="Lugares">
        {bar && <PlaceRow color={MARKER.bar} shape={styles.square} name={bar.name} detail={coord(bar.lat, bar.lng)} onPress={() => center({ lat: bar.lat, lng: bar.lng, zoom: 16, key: 'bar' })} />}
        {suppliers.isPending ? (
          <StateView kind="loading" message="Cargando proveedores…" />
        ) : suppliers.isError ? (
          <StateView kind="error" message={suppliers.error.message} onRetry={() => suppliers.refetch()} />
        ) : suppliers.data.length === 0 ? (
          <Text style={[type.small, styles.pad]}>Ningún proveedor activo tiene ubicación registrada.</Text>
        ) : (
          suppliers.data.map((s) => (
            <PlaceRow key={s.id} color={MARKER.supplier} shape={styles.diamond} name={s.name}
              detail={s.address ? `${s.address} · ${coord(s.lat, s.lng)}` : coord(s.lat, s.lng)}
              onPress={() => center({ lat: s.lat, lng: s.lng, zoom: 16, key: `p${s.id}` })} />
          ))
        )}
        {loc.position ? (
          <PlaceRow color={MARKER.device} shape={styles.circle} name="Tu posición"
            detail={`${coord(loc.position.lat, loc.position.lng)}${loc.position.accuracy ? ` · ±${Math.round(loc.position.accuracy)} m` : ''}`}
            onPress={() => center({ lat: loc.position!.lat, lng: loc.position!.lng, zoom: 17 })} />
        ) : (
          <Text style={[type.small, styles.pad]}>Tu posición aparece cuando tocas «Mi ubicación» o «Seguirme».</Text>
        )}
      </Card>
    </Screen>
  );
}

/** RF-65: sin permiso, GPS apagado o error de lectura. El mapa y la lista siguen visibles. */
function PermissionBanner({ loc }: { loc: ReturnType<typeof useLocationTracking> }) {
  switch (loc.status) {
    case 'undetermined':
      return (
        <>
          <Banner tone="neutral" icon="map-marker-account-outline" title="Permite la ubicación" text="Solo se usa mientras esta pantalla está abierta." />
          <AppButton label="Permitir ubicación" icon="map-marker-check-outline" variant="outline" onPress={loc.recheck} />
        </>
      );
    case 'denied':
      return (
        <>
          <Banner tone="red" icon="map-marker-off-outline" title="Sin permiso de ubicación" text="Actívalo en los ajustes del celular (Permisos › Ubicación). Al volver, la app lo revisa sola." />
          <AppButton label="Abrir ajustes" icon="cog-outline" variant="outline" onPress={loc.openSettings} />
        </>
      );
    case 'gps-off':
      return (
        <>
          <Banner tone="amber" icon="crosshairs-off" title="El GPS está apagado" text="Enciende la ubicación del celular para verte en el mapa." />
          <AppButton label="Ya lo encendí" icon="refresh" variant="outline" onPress={loc.recheck} />
        </>
      );
    case 'error':
      return (
        <>
          <Banner tone="red" icon="alert-circle-outline" title="No se pudo leer tu ubicación" text="Intenta de nuevo en un lugar más despejado." />
          <AppButton label="Reintentar" icon="refresh" variant="outline" onPress={loc.recheck} />
        </>
      );
    default:
      return null;
  }
}

function Legend({ shape, color, label }: { shape: ViewStyle; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.mark, shape, { backgroundColor: color }]} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function PlaceRow({ shape, color, name, detail, onPress }: { shape: ViewStyle; color: string; name: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${detail}. Centrar el mapa aquí`} onPress={onPress}
      style={({ pressed }) => [styles.place, pressed && { backgroundColor: colors.face2 }]}>
      <View style={[styles.mark, shape, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{name}</Text>
        <Text style={type.small}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 14, height: 14, borderWidth: 2, borderColor: colors.onLight },
  square: { borderRadius: 3 },
  diamond: { transform: [{ rotate: '45deg' }], width: 12, height: 12 },
  circle: { borderRadius: 7, borderColor: '#FFFFFF' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  pad: { padding: space.lg },
});
