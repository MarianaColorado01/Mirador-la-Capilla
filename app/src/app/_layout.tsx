import { Stack } from 'expo-router';

// Stack raíz. Las rutas /setup, /login, (drawer)/(tabs), /mesa/[id], etc.
// se agregan aquí a medida que se construyen (ver documentacion/arquitectura.md).
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
