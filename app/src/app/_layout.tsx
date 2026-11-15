import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Notices } from '@/components/Notices';
import { useRealtime } from '@/hooks/use-realtime';
import { useSession } from '@/store/session';
import { colors, headerOptions } from '@/theme';

/** Conecta Socket.IO mientras haya sesión (debe vivir dentro de QueryClientProvider). */
function Realtime() {
  useRealtime();
  return null;
}

/**
 * Stack raíz. Las rutas se protegen según el estado de la sesión:
 * sin servidor → /setup · sin usuario → /login · con usuario → la app.
 */
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const { hydrated, serverUrl, user } = useSession();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink2} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Realtime />
        <Stack screenOptions={{ ...headerOptions, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Protected guard={!serverUrl}>
            <Stack.Screen name="setup" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!serverUrl && !user}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!serverUrl && !!user}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="mesa/[id]" options={{ title: 'Mesa' }} />
            <Stack.Screen name="mesa/[id]/ronda" options={{ title: 'Ronda' }} />
            <Stack.Screen name="cobro/[id]" options={{ title: 'Cobrar' }} />
            <Stack.Screen name="factura/[id]" options={{ title: 'Factura' }} />
          </Stack.Protected>
        </Stack>
        {user && <Notices />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
