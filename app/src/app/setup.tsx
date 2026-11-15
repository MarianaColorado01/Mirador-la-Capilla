import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { Banner } from '@/components/ui';
import { api } from '@/services/api';
import { getDefaultServerUrl } from '@/services/server-url';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';

const IP = /^\d{1,3}(\.\d{1,3}){3}$/;

/** RF-01: escribir IP y puerto, probar la conexión y guardarla. */
export default function Setup() {
  const setServerUrl = useSession((s) => s.setServerUrl);
  const initial = getDefaultServerUrl()?.match(/^http:\/\/([\d.]+):(\d+)/);
  const [ip, setIp] = useState(initial?.[1] ?? '');
  const [port, setPort] = useState(initial?.[2] ?? '3000');

  const ipError = ip && !IP.test(ip.trim()) ? 'Escribe una IP válida, por ejemplo 192.168.1.50' : '';
  const portError = port && !/^\d{2,5}$/.test(port.trim()) ? 'El puerto es un número, por ejemplo 3000' : '';
  const url = `http://${ip.trim()}:${port.trim()}`;
  const test = useMutation({ mutationFn: () => api.health(url) });
  const valid = !!ip && !!port && !ipError && !portError;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.sign}>
        <Text style={styles.word}>MIRADOR</Text>
        <Text style={styles.word2}>LA CAPILLA · BAR POS</Text>
      </View>
      <View style={styles.body}>
        <Text style={type.h}>Conecta con el PC de caja</Text>
        <Text style={type.small}>Al arrancar, el servidor muestra su IP. La app no usa internet, solo el Wi-Fi del local.</Text>
        <View style={styles.two}>
          <View style={{ flex: 2, gap: 6 }}>
            <Text style={styles.lb}>Dirección IP</Text>
            <TextInput
              value={ip}
              onChangeText={(t) => { setIp(t); test.reset(); }}
              keyboardType="decimal-pad"
              placeholder="192.168.1.50"
              placeholderTextColor={colors.ink3}
              style={[styles.input, !!ipError && styles.err]}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.lb}>Puerto</Text>
            <TextInput
              value={port}
              onChangeText={(t) => { setPort(t); test.reset(); }}
              keyboardType="number-pad"
              style={[styles.input, !!portError && styles.err]}
            />
          </View>
        </View>
        {(ipError || portError) && <Text style={styles.errText}>{ipError || portError}</Text>}

        {test.isSuccess && <Banner tone="green" icon="check-circle-outline" title={`Respondió: ${test.data.business}`} text={`Versión ${test.data.version}`} />}
        {test.isError && (
          <Banner tone="red" icon="wifi-off" title={`No hubo respuesta de ${url}`} text="Revisa que el servidor esté corriendo y que el celular esté en el mismo Wi-Fi." />
        )}

        <AppButton label="Probar conexión" icon="wifi" variant="outline" disabled={!valid} loading={test.isPending} onPress={() => test.mutate()} />
        <AppButton label="Guardar y continuar" icon="check" disabled={!test.isSuccess} onPress={() => setServerUrl(url)} />
        <Text style={[type.small, { textAlign: 'center' }]}>La dirección queda guardada en este celular.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sign: { backgroundColor: colors.shell, borderBottomWidth: 4, borderBottomColor: colors.trim, paddingHorizontal: space.xl, paddingVertical: 28 },
  word: { color: colors.ink, fontSize: 40, fontWeight: '700', letterSpacing: 3 },
  word2: { color: colors.steel, fontSize: 14, letterSpacing: 4, marginTop: 6 },
  body: { padding: space.xl, gap: space.md },
  two: { flexDirection: 'row', gap: space.md },
  lb: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 17, backgroundColor: colors.face },
  err: { borderColor: colors.red, borderWidth: 2 },
  errText: { color: colors.red, fontSize: 13 },
});
