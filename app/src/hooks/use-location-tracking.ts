import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type Permission = 'checking' | 'granted' | 'denied';
export type Tracking = 'off' | 'on' | 'paused';
export interface Position { lat: number; lng: number; accuracy: number | null; at: number }

/**
 * Hook propio de ubicación (RF-62 a RF-65).
 * - Pide el permiso en primer plano solo al entrar a la pantalla.
 * - Activa, pausa y reanuda el seguimiento, y libera la suscripción al salir.
 * - Vuelve a revisar el permiso y el GPS cuando el usuario regresa de Ajustes.
 */
export function useLocationTracking() {
  const [permission, setPermission] = useState<Permission>('checking');
  const [gpsOn, setGpsOn] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const [tracking, setTracking] = useState<Tracking>('off');
  const [error, setError] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const stopWatch = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
  }, []);

  const check = useCallback(async (ask: boolean) => {
    try {
      const current = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      setPermission(current.status === 'granted' ? 'granted' : 'denied');
      setGpsOn(await Location.hasServicesEnabledAsync());
    } catch {
      setPermission('denied');
    }
  }, []);

  const startWatch = useCallback(async () => {
    stopWatch();
    setError(null);
    try {
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 5 },
        (p) => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp }),
      );
      setTracking('on');
    } catch {
      setTracking('off');
      setError('No se pudo seguir la ubicación. Revisa que el GPS esté encendido.');
    }
  }, [stopWatch]);

  /** RF-63: obtener la posición una vez para centrar el mapa. */
  const locateOnce = useCallback(async (): Promise<Position | null> => {
    setError(null);
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
      setPosition(pos);
      return pos;
    } catch {
      setGpsOn(await Location.hasServicesEnabledAsync().catch(() => false));
      setError('No se pudo obtener tu ubicación.');
      return null;
    }
  }, []);

  const pause = useCallback(() => { stopWatch(); setTracking('paused'); }, [stopWatch]);
  const resume = useCallback(() => { void startWatch(); }, [startWatch]);

  // Al entrar a la pantalla se pide el permiso; al salir se libera la suscripción.
  useFocusEffect(
    useCallback(() => {
      void check(true);
      return () => {
        stopWatch();
        setTracking((t) => (t === 'on' ? 'paused' : t));
      };
    }, [check, stopWatch]),
  );

  // Al volver de Ajustes del celular se revisa otra vez el permiso y el GPS (RF-65).
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') void check(false);
    });
    return () => s.remove();
  }, [check]);

  // Si se pierde el permiso o se apaga el GPS, se detiene el seguimiento.
  useEffect(() => {
    if (permission === 'denied' || !gpsOn) stopWatch();
  }, [permission, gpsOn, stopWatch]);

  return { permission, gpsOn, position, tracking: permission === 'granted' && gpsOn ? tracking : 'off', error, startWatch, pause, resume, locateOnce, recheck: () => check(true) };
}
