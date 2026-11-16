import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Profile } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { StateView } from '@/components/StateView';
import { Banner } from '@/components/ui';
import { keys } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';

const ROLE = { todo: 'Todo en uno · L–S', mesero: 'Mesero', barra: 'Barra', caja: 'Caja', dueno: 'Dueño' } as const;

/** RF-05: elegir perfil e ingresar el PIN. RF-08: bloqueo tras intentos fallidos. */
export default function Login() {
  const { serverUrl, signIn, setServerUrl } = useSession();
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: keys.profiles(serverUrl), queryFn: api.profiles });
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');

  const login = useMutation({
    mutationFn: () => api.login(selected!.id, pin),
    onSuccess: (u) => {
      // Que el nuevo usuario no vea por un momento cuentas o facturas del anterior.
      qc.removeQueries({ predicate: (q) => !['health', 'profiles'].includes(String(q.queryKey[0])) });
      signIn(u);
    },
    onError: () => setPin(''),
  });

  const err = login.error instanceof ApiError ? login.error : null;
  const errText =
    err?.status === 423
      ? `Perfil bloqueado. Intenta de nuevo en ${Math.ceil(Number(err.data?.retryAfterSeconds ?? 60) / 60)} min o elige otro perfil.`
      : err?.status === 401 && err.data?.attemptsLeft != null
        ? `PIN incorrecto. Te quedan ${String(err.data.attemptsLeft)} ${err.data.attemptsLeft === 1 ? 'intento' : 'intentos'}.`
        : err?.message;

  const press = (k: string) => {
    login.reset();
    setPin((p) => (k === 'del' ? p.slice(0, -1) : p.length < 4 ? p + k : p));
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={type.title}>¿Quién atiende?</Text>
          <Text style={type.small}>Elige tu perfil e ingresa tu PIN personal.</Text>
        </View>

        {profiles.isPending ? (
          <StateView kind="loading" />
        ) : profiles.isError ? (
          <StateView kind="error" message={(profiles.error as Error).message} onRetry={() => profiles.refetch()} />
        ) : (
          <View style={styles.list}>
            {profiles.data.map((p) => {
              const on = selected?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => { setSelected(p); setPin(''); login.reset(); }}
                  style={[styles.profile, on && styles.profileOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.radio, on && styles.radioOn]} />
                  <Text style={[type.body, { flex: 1, fontWeight: '600' }]}>{p.name}</Text>
                  <Text style={type.label}>{ROLE[p.role]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected && (
          <>
            <Text style={[type.small, { textAlign: 'center' }]}>PIN de {selected.name}</Text>
            <View style={styles.dots} accessibilityLabel={`${pin.length} de 4 dígitos`}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
              ))}
            </View>
            {errText && <Banner tone={err?.status === 423 ? 'amber' : 'red'} icon={err?.status === 423 ? 'lock-outline' : 'alert-outline'} title={errText} />}
            <View style={styles.keys}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
                k === '' ? (
                  <View key={i} style={styles.key} />
                ) : (
                  <Pressable key={i} style={styles.key} onPress={() => press(k)} accessibilityLabel={k === 'del' ? 'Borrar' : k}>
                    {k === 'del' ? <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.ink} /> : <Text style={styles.keyText}>{k}</Text>}
                  </Pressable>
                ),
              )}
            </View>
            <AppButton label={`Ingresar como ${selected.name}`} disabled={pin.length < 4} loading={login.isPending} onPress={() => login.mutate()} />
          </>
        )}

        <AppButton label="Cambiar servidor" icon="lan-connect" variant="text" onPress={() => setServerUrl(null)} />
        <Text style={[type.small, { textAlign: 'center' }]}>Servidor: {serverUrl}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.xl, gap: space.md },
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.face },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.line2 },
  profileOn: { backgroundColor: colors.face2, borderLeftWidth: 3, borderLeftColor: colors.trim },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink3 },
  radioOn: { borderColor: colors.trim, backgroundColor: colors.trim },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.ink2 },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: { width: '31.5%', height: 56, borderRadius: radius.md, backgroundColor: colors.face, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: colors.ink, fontSize: 24, fontWeight: '700' },
});
