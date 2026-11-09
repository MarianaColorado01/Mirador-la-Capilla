import Constants from 'expo-constants';

const SERVER_PORT = 3000;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * URL del servidor del local mientras desarrollamos.
 *
 * 1. EXPO_PUBLIC_SERVER_URL en app/.env.local, si existe.
 * 2. Si no, la IP del PC que corre Metro (la misma a la que se conectó Expo Go),
 *    con el puerto del servidor. Así no hay que configurar nada si el servidor
 *    corre en el mismo PC.
 *
 * En la app final la dirección la elige el usuario en /setup (RF-01) y se
 * guarda en el celular (RF-02); esto es solo el valor por defecto.
 */
export function getDefaultServerUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  // Con --tunnel el host es un dominio de ngrok, no el PC: ahí no sirve.
  if (host && IPV4.test(host)) return `http://${host}:${SERVER_PORT}`;
  return null;
}
