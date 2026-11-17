import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { DrawerToggleButton } from 'expo-router/drawer';
import { Tabs } from 'expo-router/js-tabs';
import type { Role } from '@mirador/shared';
import { useSession } from '@/store/session';
import { colors, fonts, headerOptions } from '@/theme';

/** Pestañas según el rol (RF-06). El servidor también niega lo que el rol no puede hacer. */
const TABS: Record<'index' | 'barra' | 'caja' | 'inventario', Role[]> = {
  index: ['todo', 'mesero', 'caja', 'dueno'],
  barra: ['todo', 'barra', 'dueno'],
  caja: ['todo', 'caja', 'dueno'],
  inventario: ['dueno'],
};

export default function TabsLayout() {
  const role = useSession((s) => s.user?.role ?? 'mesero');
  const show = (tab: keyof typeof TABS) => (TABS[tab].includes(role) ? undefined : null);
  // Con una sola pestaña visible (mesero, barra) no tiene sentido mostrar la barra inferior.
  const visible = (Object.keys(TABS) as (keyof typeof TABS)[]).filter((t) => TABS[t].includes(role)).length;

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        // Menú lateral con Facturas, Ajustes, Usuarios y Cambiar de perfil (RF-06).
        headerLeft: () => <DrawerToggleButton tintColor={colors.ink} accessibilityLabel="Abrir menú" />,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: visible > 1 ? { backgroundColor: colors.face, borderTopColor: colors.line } : { display: 'none' },
        tabBarLabelStyle: { fontFamily: fonts.display, letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Mesas', href: show('index'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="table-chair" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="barra"
        options={{ title: 'Barra', href: show('barra'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="glass-cocktail" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="caja"
        options={{ title: 'Caja', href: show('caja'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash-register" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="inventario"
        options={{ title: 'Inventario', href: show('inventario'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="package-variant" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
