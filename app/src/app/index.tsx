import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BUSINESS_NAME, type HealthResponse } from '@mirador/shared';

// Pantalla temporal: comprueba que la app alcanza al servidor del local.
// La URL sale de EXPO_PUBLIC_SERVER_URL (app/.env.local); en la app final la
// configura el usuario en /setup (RF-01) y se guarda con Zustand (RF-02).
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://192.168.1.50:3000';

type Status = { kind: 'checking' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

export default function Index() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`${SERVER_URL}/health`, { signal: controller.signal })
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch(() => setStatus({ kind: 'error', message: `No hubo respuesta de ${SERVER_URL}` }))
      .finally(() => clearTimeout(timer));
    return () => controller.abort();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.sign}>
        <Text style={styles.word}>MIRADOR</Text>
        <Text style={styles.word2}>LA CAPILLA · BAR POS</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Servidor</Text>
        <Text style={styles.value}>{SERVER_URL}</Text>
        <Text style={[styles.state, status.kind === 'ok' ? styles.ok : status.kind === 'error' ? styles.err : null]}>
          {status.kind === 'checking' && 'Comprobando conexión…'}
          {status.kind === 'ok' && `Conectado · ${status.data.business}`}
          {status.kind === 'error' && status.message}
        </Text>
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
  foot: { color: '#9298A1', textAlign: 'center' },
});
