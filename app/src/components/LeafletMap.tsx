import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radius } from '@/theme';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: 'bar' | 'supplier';
}

export interface LeafletMapHandle {
  centerOn: (lat: number, lng: number, zoom?: number) => void;
  fitAll: () => void;
}

interface Props {
  markers: MapMarker[];
  device: { lat: number; lng: number; accuracy: number | null } | null;
  onReady?: () => void;
  onFail?: (reason: string) => void;
}

/* OpenStreetMap + Leaflet dentro de un WebView (RF-61). El bar, los proveedores y el
   celular tienen marcadores distintos. No se trazan líneas entre puntos (RF-66). */
const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;background:#1E2124}
  .pin{display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)}
  .pin b{font:700 11px/1.2 sans-serif;letter-spacing:.06em;text-transform:uppercase;background:#111214;color:#F2F2F2;padding:3px 6px;border-radius:4px;white-space:nowrap;margin-bottom:2px}
  .dot{width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)}
  .bar .dot{background:#E9474E;width:20px;height:20px} .supplier .dot{background:#2F2F35}
  .me{width:16px;height:16px;border-radius:50%;background:#2F7BF6;border:3px solid #fff;box-shadow:0 0 0 8px rgba(47,123,246,.25)}
</style></head><body><div id="map"></div>
<script>
function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
window.onerror = function(msg){ post({type:'fail', reason:String(msg)}); };
var s = document.createElement('script');
s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
s.onerror = function(){ post({type:'fail', reason:'leaflet'}); };
s.onload = function(){
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([4.99, -75.82], 13);
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  var tileErrors = 0, tileOk = false;
  tiles.on('tileload', function(){ tileOk = true; });
  tiles.on('tileerror', function(){ tileErrors++; if (!tileOk && tileErrors > 6) post({type:'fail', reason:'tiles'}); });
  var layer = L.layerGroup().addTo(map), me = null, all = [];
  window.setMarkers = function(list){
    layer.clearLayers(); all = [];
    list.forEach(function(m){
      var icon = L.divIcon({ className: m.kind, html: '<div class="pin"><b>' + m.label + '</b><div class="dot"></div></div>', iconSize: null, iconAnchor: [0, 30] });
      L.marker([m.lat, m.lng], { icon: icon }).addTo(layer); all.push([m.lat, m.lng]);
    });
  };
  window.setDevice = function(d){
    if (!d) { if (me) { map.removeLayer(me); me = null; } return; }
    var icon = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16,16], iconAnchor: [8,8] });
    if (!me) me = L.marker([d.lat, d.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map); else me.setLatLng([d.lat, d.lng]);
  };
  window.centerOn = function(lat, lng, z){ map.setView([lat, lng], z || 16); };
  window.fitAll = function(){ if (all.length) map.fitBounds(all, { padding: [50, 50], maxZoom: 15 }); };
  post({type:'ready'});
};
document.head.appendChild(s);
</script></body></html>`;

export const LeafletMap = forwardRef<LeafletMapHandle, Props>(function LeafletMap({ markers, device, onReady, onFail }, ref) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const run = useCallback((js: string) => { if (ready.current) web.current?.injectJavaScript(`${js};true;`); }, []);

  useImperativeHandle(ref, () => ({
    centerOn: (lat, lng, zoom) => run(`window.centerOn(${lat}, ${lng}, ${zoom ?? 16})`),
    fitAll: () => run('window.fitAll()'),
  }), [run]);

  useEffect(() => { run(`window.setMarkers(${JSON.stringify(markers)})`); }, [markers, run]);
  useEffect(() => { run(`window.setDevice(${JSON.stringify(device)})`); }, [device, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: 'ready' | 'fail'; reason?: string };
      if (m.type === 'ready') {
        ready.current = true;
        web.current?.injectJavaScript(`window.setMarkers(${JSON.stringify(markers)});window.setDevice(${JSON.stringify(device)});window.fitAll();true;`);
        onReady?.();
      } else onFail?.(m.reason ?? 'mapa');
    } catch {
      /* mensaje ajeno */
    }
  };

  return (
    <View style={styles.box}>
      <WebView
        ref={web}
        source={{ html: HTML, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => onFail?.('webview')}
        onHttpError={() => onFail?.('http')}
        javaScriptEnabled
        style={{ backgroundColor: '#1E2124' }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  box: { height: 420, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
});
