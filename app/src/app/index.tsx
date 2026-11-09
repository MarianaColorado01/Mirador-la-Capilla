import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BUSINESS_NAME, type HealthResponse } from '@mirador/shared';

import { getDefaultServerUrl } from '@/services/server-url';

// Pantalla temporal: comprueba que la app alcanza al servidor del local.
const SERVER_URL = getDefaultServerUrl();

type Status =
  | { kind: 'checking' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

const NO_URL: Status = { kind: 'error', message: 'No se pudo deducir la IP del PC. Escríbela en app/.env.local.' };

/** Consulta /health con un límite de 5 s y devuelve el estado resultante. */
async function probe(url: string, signal: AbortSignal): Promise<Status> {
  // AbortSignal.timeout/any no están garantizados en Hermes: se combina a mano.
  const inner = new AbortController();
  const timer = setTimeout(() => inner.abort(), 5000);
  signal.addEventListener('abort', () => inner.abort());
  try {
    const r = await fetch(`${url}/health`, { signal: inner.signal });
    return { kind: 'ok', data: (await r.json()) as HealthResponse };
  } catch {
    return {
      kind: 'error',
      message: 'No hubo respuesta. Revisa que el servidor esté corriendo (npm run server) y que el celular esté en el mismo Wi-Fi.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export default function Index() {
  const [status, setStatus] = useState<Status>(SERVER_URL ? { kind: 'checking' } : NO_URL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!SERVER_URL) return;
    const controller = new AbortController();
    probe(SERVER_URL, controller.signal).then((s) => {
      if (!controller.signal.aborted) setStatus(s);
    });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus({ kind: 'checking' });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.sign}>
        <Text style={styles.word}>MIRADOR</Text>
        <Text style={styles.word2}>LA CAPILLA · BAR POS</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Servidor</Text>
        <Text style={styles.value}>{SERVER_URL ?? 'Sin dirección'}</Text>
        <Text style={[styles.state, status.kind === 'ok' ? styles.ok : status.kind === 'error' ? styles.err : null]}>
          {status.kind === 'checking' && 'Comprobando conexión…'}
          {status.kind === 'ok' && `Conectado · ${status.data.business}`}
          {status.kind === 'error' && status.message}
        </Text>
        {status.kind === 'error' && (
          <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.foot}>{BUSINESS_NAME}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0F', padding: 24, gap: 24, justifyContent: 'center' },
  sign: { backgroundColor: '#111214', borderBottomWidth: 4, borderBottomColor: '#FFC53D', padding: 24, borderRadius: 12 },
  word: { color: '#F2F2F2', fontSize: 40, fontWeight: '700', letterSpacing: 3 },
  word2: { color: '#B6BBC2', fontSize: 15, letterSpacing: 4, marginTop: 6 },
  card: { backgroundColor: '#18181B', borderRadius: 12, padding: 18, gap: 6, borderWidth: 1, borderColor: '#2F3136' },
  label: { color: '#9298A1', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  value: { color: '#F2F2F2', fontSize: 16 },
  state: { color: '#BCC1C8', fontSize: 15, marginTop: 6 },
  ok: { color: '#45D483' },
  err: { color: '#FF6B63' },
  button: { marginTop: 10, minHeight: 48, borderRadius: 10, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#0D0D0F', fontSize: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  foot: { color: '#9298A1', textAlign: 'center' },
});
