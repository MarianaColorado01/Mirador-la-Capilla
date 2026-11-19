import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Profile } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { StateView } from '@/components/StateView';
import { Banner } from '@/components/ui';
import { keys } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, text } from '@/theme';

const KEY = 'w-[31.5%] h-[56px] rounded-md bg-face border border-line items-center justify-center';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerClassName="p-xl gap-md" keyboardShouldPersistTaps="handled">
        <View>
          <Text className={text.title}>¿Quién atiende?</Text>
          <Text className={text.small}>Elige tu perfil e ingresa tu PIN personal.</Text>
        </View>

        {profiles.isPending ? (
          <StateView kind="loading" />
        ) : profiles.isError ? (
          <StateView kind="error" message={(profiles.error as Error).message} onRetry={() => profiles.refetch()} />
        ) : (
          <View className="border border-line rounded-md overflow-hidden bg-face">
            {profiles.data.map((p) => {
              const on = selected?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => { setSelected(p); setPin(''); login.reset(); }}
                  className={`flex-row items-center gap-md min-h-[52px] px-[14px] border-t border-t-line2 ${on ? 'bg-face2 border-l-[3px] border-l-trim' : ''}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <View className={`w-[20px] h-[20px] rounded-[10px] border-2 ${on ? 'border-trim bg-trim' : 'border-ink3'}`} />
                  <Text className="flex-1 font-body-semi text-[15px] text-ink">{p.name}</Text>
                  <Text className={text.label}>{ROLE[p.role]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected && (
          <>
            <Text className={`${text.small} text-center`}>PIN de {selected.name}</Text>
            <View className="flex-row justify-center gap-lg" accessibilityLabel={`${pin.length} de 4 dígitos`}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className={`w-[16px] h-[16px] rounded-[8px] border-2 ${i < pin.length ? 'bg-ink border-ink' : 'border-ink2'}`} />
              ))}
            </View>
            {errText && <Banner tone={err?.status === 423 ? 'amber' : 'red'} icon={err?.status === 423 ? 'lock-outline' : 'alert-outline'} title={errText} />}
            <View className="flex-row flex-wrap gap-sm">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
                k === '' ? (
                  <View key={i} className={KEY} />
                ) : (
                  <Pressable key={i} className={KEY} onPress={() => press(k)} accessibilityLabel={k === 'del' ? 'Borrar' : k}>
                    {k === 'del' ? <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.ink} /> : <Text className="font-display text-[24px] text-ink">{k}</Text>}
                  </Pressable>
                ),
              )}
            </View>
            <AppButton label={`Ingresar como ${selected.name}`} disabled={pin.length < 4} loading={login.isPending} onPress={() => login.mutate()} />
          </>
        )}

        <AppButton label="Cambiar servidor" icon="lan-connect" variant="text" onPress={() => setServerUrl(null)} />
        <Text className={`${text.small} text-center`}>Servidor: {serverUrl}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
