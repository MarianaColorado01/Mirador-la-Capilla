import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, space, type } from '@/theme';
import { AppButton } from './AppButton';

export type MapPlace = { key: string; kind: 'bar' | 'supplier'; name: string; lat: number; lng: number };
export type MapFocus = { lat: number; lng: number; zoom: number; key?: string };

/** Colores de los marcadores; la leyenda de la pantalla usa los mismos. Además cambian de forma (RF-62). */
export const MARKER = { bar: colors.amber, supplier: colors.ocupada, device: '#4DA3FF' } as const;

// Si en este tiempo no llega ni una tesela, el mapa se da por caído (el local puede no tener internet).
const TIMEOUT_MS = 15000;

/*
 * Página de Leaflet: versión fija con SRI desde unpkg y teselas de OpenStreetMap con su atribución.
 * Se carga una sola vez; después la app le habla con injectJavaScript (setPlaces, setDevice, focusOn)
 * y ella responde con postMessage: «ready» (Leaflet listo), «tiles» (se ve el mapa) o «error».
 * Bar = cuadrado, proveedor = rombo, celular = círculo: se distinguen sin depender del color.
 */
const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
html,body,#map{height:100%;margin:0;background:${colors.face}}
.pin{box-sizing:border-box;border:2px solid ${colors.onLight}}
.bar{background:${MARKER.bar};border-radius:4px}
.supplier{background:${MARKER.supplier};transform:rotate(45deg)}
.device{background:${MARKER.device};border:3px solid #fff;border-radius:50%}
</style></head><body><div id="map"></div>
<script>function send(t){window.ReactNativeWebView.postMessage(t)}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="send('error')"></script>
<script>
if (!window.L) { send('error'); } else {
  var map = L.map('map').setView([0, 0], 2), ok = false, fails = 0, byKey = {}, device = null, ring = null;
  var places = L.layerGroup().addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).on('tileload', function () { if (!ok) { ok = true; send('tiles'); } })
    .on('tileerror', function () { if (!ok && ++fails >= 4) send('error'); })
    .addTo(map);
  function icon(kind, size) {
    return L.divIcon({ className: '', iconSize: [size, size], html: '<div class="pin ' + kind + '" style="width:' + size + 'px;height:' + size + 'px"></div>' });
  }
  // textContent y no HTML: los nombres los escribe el usuario.
  function label(t) { var s = document.createElement('span'); s.textContent = t; return s; }
  window.setPlaces = function (list) {
    places.clearLayers(); byKey = {};
    list.forEach(function (p) {
      var bar = p.kind === 'bar';
      byKey[p.key] = L.marker([p.lat, p.lng], { icon: icon(p.kind, bar ? 24 : 18), zIndexOffset: bar ? 500 : 0 })
        .bindTooltip(label(p.name)).addTo(places);
    });
  };
  window.setDevice = function (p) {
    if (!p) { if (device) { device.remove(); ring.remove(); device = ring = null; } return; }
    var ll = [p.lat, p.lng];
    if (!device) {
      ring = L.circle(ll, { radius: p.accuracy || 0, color: '${MARKER.device}', weight: 1, fillOpacity: 0.12 }).addTo(map);
      device = L.marker(ll, { icon: icon('device', 20), zIndexOffset: 1000 }).bindTooltip(label('Tu posición')).addTo(map);
    } else { device.setLatLng(ll); ring.setLatLng(ll).setRadius(p.accuracy || 0); }
  };
  window.focusOn = function (f) { map.setView([f.lat, f.lng], f.zoom); if (f.key && byKey[f.key]) byKey[f.key].openTooltip(); };
  send('ready');
}
</script></body></html>`;

type Props = { places: MapPlace[]; device: { lat: number; lng: number; accuracy: number | null } | null; focus: MapFocus | null };

/**
 * RF-61: mapa OpenStreetMap + Leaflet en una WebView. Mover el marcador del celular o centrar
 * no recarga la página. Si Leaflet o las teselas no cargan, muestra el fallo con Reintentar y
 * el resto de la pantalla sigue funcionando (RF-65).
 */
export function LeafletMap({ places, device, focus }: Props) {
  const web = useRef<WebView>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'ok' | 'error'>('loading');
  const live = state === 'ready' || state === 'ok';
  const settled = state === 'ok' || state === 'error';

  useEffect(() => {
    if (settled) return;
    const t = setTimeout(() => setState('error'), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [settled, attempt]);

  useEffect(() => {
    if (live) web.current?.injectJavaScript(`setPlaces(${JSON.stringify(places)});true;`);
  }, [live, places]);
  useEffect(() => {
    if (live) web.current?.injectJavaScript(`setDevice(${JSON.stringify(device)});true;`);
  }, [live, device]);
  useEffect(() => {
    if (live && focus) web.current?.injectJavaScript(`focusOn(${JSON.stringify(focus)});true;`);
  }, [live, focus]);

  const retry = () => {
    setState('loading');
    setAttempt((a) => a + 1);
  };

  if (state === 'error') {
    return (
      <View style={[styles.box, styles.center]} accessibilityLiveRegion="polite">
        <MaterialCommunityIcons name="map-marker-off-outline" size={30} color={colors.red} />
        <Text style={type.h}>No se pudo cargar el mapa</Text>
        <Text style={[type.small, styles.text]}>El mapa necesita internet. La lista de lugares de abajo sigue disponible.</Text>
        <AppButton label="Reintentar" icon="refresh" variant="outline" compact onPress={retry} />
      </View>
    );
  }

  return (
    <View style={styles.box} accessible accessibilityLabel="Mapa del bar, los proveedores y tu posición. La lista de lugares está debajo.">
      <WebView
        key={attempt}
        ref={web}
        originWhitelist={['*']}
        source={{ html: HTML }}
        applicationNameForUserAgent="MiradorLaCapilla/1.0"
        nestedScrollEnabled
        onMessage={(e) => {
          const m = e.nativeEvent.data;
          if (m === 'ready') setState((s) => (s === 'loading' ? 'ready' : s));
          else if (m === 'tiles') setState('ok');
          else if (m === 'error') setState('error');
        }}
        onError={() => setState('error')}
        // Enlaces del mapa (la atribución de OSM) se abren en el navegador, no dentro del mapa.
        onShouldStartLoadWithRequest={(r) => {
          if (!r.url.startsWith('http')) return true;
          Linking.openURL(r.url);
          return false;
        }}
        style={styles.web}
      />
      {state !== 'ok' && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.ink2} />
          <Text style={type.small}>Cargando mapa…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 340, backgroundColor: colors.face },
  web: { flex: 1, backgroundColor: colors.face },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  text: { textAlign: 'center' },
});
