import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/store/session';
import { useSettings } from './queries';

/**
 * RF-09: cierra la sesión tras `idleLogoutMinutes` (ajuste del servidor) sin tocar la pantalla.
 * Devuelve la función que reinicia el conteo; se llama en cada toque del View raíz.
 */
export function useIdleLogout() {
  const loggedIn = useSession((s) => !!s.user);
  const signOut = useSession((s) => s.signOut);
  const minutes = useSettings(loggedIn).data?.idleLogoutMinutes;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTouch = useRef(0); // se fija en el primer touch() del efecto

  const touch = useCallback(() => {
    lastTouch.current = Date.now();
    clearTimeout(timer.current);
    if (loggedIn && minutes) timer.current = setTimeout(signOut, minutes * 60_000);
  }, [loggedIn, minutes, signOut]);

  useEffect(() => {
    touch();
    // En segundo plano el sistema puede pausar el temporizador: al volver se revisa el tiempo real.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && loggedIn && minutes && Date.now() - lastTouch.current >= minutes * 60_000) signOut();
    });
    return () => {
      clearTimeout(timer.current);
      sub.remove();
    };
  }, [touch, loggedIn, minutes, signOut]);

  return touch;
}
