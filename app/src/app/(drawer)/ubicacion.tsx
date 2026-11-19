import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { LeafletMap, type LeafletMapHandle, type MapMarker } from '@/components/LeafletMap';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card } from '@/components/ui';
import { useSettings, useSuppliers } from '@/hooks/queries';
import { useLocationTracking } from '@/hooks/use-location-tracking';
import { colors, space, type } from '@/theme';

// El nombre va dentro del HTML del mapa: se quitan caracteres que podrían romperlo.
const safe = (s: string) => s.replace(/[<>&"'`\\]/g, '');

/** RF-61 a RF-66: mapa del bar y de los proveedores con la ubicación del celular. */
export default function Ubicacion() {
  const { supplierId } = useLocalSearchParams<{ supplierId?: string }>();
  const settings = useSettings();
  const suppliers = useSuppliers();
  const loc = useLocationTracking();
  const map = useRef<LeafletMapHandle>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mapKey, setMapKey] = useState(0);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (settings.data) list.push({ id: 'bar', kind: 'bar', lat: settings.data.barLat, lng: settings.data.barLng, label: safe(settings.data.businessName) });
    for (const s of suppliers.data ?? []) if (s.lat != null && s.lng != null) list.push({ id: `s${s.id}`, kind: 'supplier', lat: s.lat, lng: s.lng, label: safe(s.name) });
    return list;
  }, [settings.data, suppliers.data]);

  // RF-66: desde el detalle de un proveedor se abre el mapa centrado en él (sin trazar ruta).
  const focus = supplierId ? suppliers.data?.find((s) => s.id === Number(supplierId)) : undefined;
  useEffect(() => {
    if (mapState === 'ready' && focus?.lat != null && focus.lng != null) map.current?.centerOn(focus.lat, focus.lng, 15);
  }, [mapState, focus]);

  const device = loc.position ? { lat: loc.position.lat, lng: loc.position.lng, accuracy: loc.position.accuracy } : null;
  const canLocate = loc.permission === 'granted' && loc.gpsOn;

  const centerMe = async () => {
    const p = loc.position ?? (await loc.locateOnce());
    if (p) map.current?.centerOn(p.lat, p.lng, 16);
  };

  return (
    <Screen>
      {loc.permission === 'denied' && (
        <Card>
          <View style={styles.box}>
            <Text style={type.h}>Sin permiso de ubicación</Text>
            <Text style={type.small}>Puedes ver el bar y los proveedores, pero no tu posición. Al volver de Ajustes se revisa el permiso otra vez.</Text>
            <AppButton label="Abrir ajustes del celular" icon="cog-outline" compact onPress={() => Linking.openSettings()} />
          </View>
        </Card>
      )}
      {loc.permission === 'granted' && !loc.gpsOn && (
        <Banner tone="amber" icon="crosshairs-off" title="GPS apagado" text="Actívalo en el celular para ver tu posición. El resto de la app sigue funcionando." />
      )}
      {loc.error && <Banner tone="amber" icon="alert-outline" title={loc.error} />}

      {mapState === 'failed' ? (
        <Card>
          <StateView
            kind="error"
            message="El mapa necesita datos móviles o internet para descargar OpenStreetMap. Lo demás de la app funciona en la red local."
            onRetry={() => { setMapState('loading'); setMapKey((k) => k + 1); }}
          />
        </Card>
      ) : settings.isPending ? (
        <StateView kind="loading" message="Cargando mapa…" />
      ) : (
        <LeafletMap key={mapKey} ref={map} markers={markers} device={device} onReady={() => setMapState('ready')} onFail={() => setMapState('failed')} />
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppButton label="Centrar en mí" icon="crosshairs-gps" variant="outline" compact disabled={!canLocate || mapState !== 'ready'} onPress={centerMe} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton label="Ver todo" icon="fit-to-screen-outline" variant="outline" compact disabled={mapState !== 'ready'} onPress={() => map.current?.fitAll()} />
        </View>
      </View>

      <Card>
        <View style={[styles.box, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>
              Seguimiento {loc.tracking === 'on' ? 'activo' : loc.tracking === 'paused' ? 'en pausa' : 'apagado'}
            </Text>
            <Text style={type.small}>
              {loc.position ? `Precisión ${Math.round(loc.position.accuracy ?? 0)} m` : canLocate ? 'Aún sin posición' : 'Necesita permiso y GPS'}
            </Text>
          </View>
          {loc.tracking === 'on' ? (
            <AppButton label="Pausar" icon="pause" variant="outline" compact onPress={loc.pause} />
          ) : (
            <AppButton label={loc.tracking === 'paused' ? 'Reanudar' : 'Activar'} icon="play" compact disabled={!canLocate} onPress={loc.tracking === 'paused' ? loc.resume : loc.startWatch} />
          )}
        </View>
      </Card>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#E9474E' }]} /><Text style={type.small}>Bar</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#2F2F35', borderWidth: 1, borderColor: colors.ink3 }]} /><Text style={type.small}>Proveedor</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#2F7BF6' }]} /><Text style={type.small}>Este celular</Text></View>
      </View>
      <Text style={type.small}>{settings.data?.barAddress}. Las coordenadas del bar son aproximadas hasta confirmarlas.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
