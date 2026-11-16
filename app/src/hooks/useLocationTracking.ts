import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type LocationStatus = 'checking' | 'undetermined' | 'granted' | 'denied' | 'gps-off' | 'error';
export type Tracking = 'off' | 'on' | 'paused';
export type DevicePosition = { lat: number; lng: number; accuracy: number | null };

const toPosition = (l: Location.LocationObject): DevicePosition => ({ lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy });

/**
 * Hook propio de la pantalla Ubicación (RF-62 a RF-65). Solo ubicación en primer plano.
 *
 * Entradas: ninguna; se usa dentro de la pantalla del mapa, que es la que «entra» y «sale».
 * Estado (useState):
 *  - `status`: checking (verificando) · undetermined (aún no responde) · granted · denied ·
 *    gps-off (permiso dado pero el GPS del celular apagado) · error (falló la lectura).
 *  - `position`: última posición del celular o null.
 *  - `tracking`: off (nunca activado) · on (escuchando) · paused (suscripción liberada).
 *  - `locating`: true mientras «Mi ubicación» espera el GPS.
 * Efectos:
 *  1. useFocusEffect: al entrar a la pantalla pide el permiso (RF-62); al salir libera la
 *     suscripción de seguimiento y lo deja en pausa (RF-64). El Drawer no desmonta la
 *     pantalla al cambiar de opción, por eso se usa el foco y no solo el desmontaje.
 *  2. AppState: al volver a la app (p. ej. desde Ajustes) vuelve a verificar permiso y GPS
 *     sin volver a preguntar (RF-65).
 *  3. Desmontaje: `subscription.remove()` por si la pantalla se destruye con el seguimiento activo.
 * Resultado: el estado de arriba y las acciones `locate` (RF-63, devuelve la posición para
 * centrar el mapa), `start`/`pause` (RF-64), `recheck` y `openSettings` (RF-65).
 */
export function useLocationTracking() {
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [tracking, setTracking] = useState<Tracking>('off');
  const [locating, setLocating] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  // Sube cada vez que se pide parar: si watchPositionAsync responde tarde, esa suscripción se descarta.
  const gen = useRef(0);

  /** Verifica permiso y GPS. `ask` = mostrar el diálogo del sistema si aún se puede preguntar. */
  const check = useCallback(async (ask: boolean) => {
    try {
      const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus(perm.status === 'undetermined' ? 'undetermined' : 'denied');
        return false;
      }
      const gps = await Location.hasServicesEnabledAsync();
      setStatus(gps ? 'granted' : 'gps-off');
      return gps;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    gen.current++;
    sub.current?.remove();
    sub.current = null;
  }, []);

  useFocusEffect(
    useCallback(() => {
      check(true);
      return () => {
        if (sub.current) setTracking('paused');
        stop();
      };
    }, [check, stop]),
  );

  useEffect(() => {
    const s = AppState.addEventListener('change', (next) => {
      if (next === 'active') check(false);
    });
    return () => s.remove();
  }, [check]);

  useEffect(() => stop, [stop]);

  const locate = async () => {
    if (!(await check(false))) return null;
    setLocating(true);
    try {
      const p = toPosition(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setPosition(p);
      return p;
    } catch {
      // Lo más común es que el GPS se apagó a mitad de camino; check lo distingue de un error real.
      if (await check(false)) setStatus('error');
      return null;
    } finally {
      setLocating(false);
    }
  };

  const start = async () => {
    if (sub.current || !(await check(false))) return;
    const my = ++gen.current;
    try {
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (l) => setPosition(toPosition(l)),
        () => setStatus('error'),
      );
      if (my !== gen.current) return s.remove(); // se pausó o se salió mientras arrancaba
      sub.current = s;
      setTracking('on');
    } catch {
      setStatus('error');
    }
  };

  const pause = () => {
    stop();
    setTracking('paused');
  };

  return { status, position, tracking, locating, locate, start, pause, recheck: () => check(true), openSettings: () => Linking.openSettings() };
}
