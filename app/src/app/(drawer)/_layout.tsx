import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, usePathname } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role } from '@mirador/shared';
import { useSession } from '@/store/session';
import { colors, headerOptions } from '@/theme';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

/** Opciones del menú lateral según el rol (RF-06). Cada una abre una función real. */
const DRAWER_ITEMS: { href: '/' | '/dashboard' | '/facturas' | '/proveedores' | '/gastos' | '/ubicacion'; label: string; icon: Icon; roles: Role[] }[] = [
  { href: '/', label: 'Operación', icon: 'table-chair', roles: ['todo', 'mesero', 'barra', 'caja', 'dueno'] },
  { href: '/dashboard', label: 'Resumen del negocio', icon: 'chart-bar', roles: ['dueno'] },
  { href: '/facturas', label: 'Facturas', icon: 'receipt', roles: ['todo', 'caja', 'dueno'] },
  { href: '/proveedores', label: 'Proveedores y compras', icon: 'truck-outline', roles: ['dueno'] },
  { href: '/gastos', label: 'Gastos', icon: 'wallet-outline', roles: ['dueno'] },
  { href: '/ubicacion', label: 'Ubicación', icon: 'map-marker-outline', roles: ['todo', 'mesero', 'barra', 'caja', 'dueno'] },
];

const ROLE = { todo: 'Todo en uno', mesero: 'Mesero', barra: 'Barra', caja: 'Caja', dueno: 'Dueño' } as const;

function DrawerContent() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const path = usePathname();
  const items = DRAWER_ITEMS.filter((i) => user && i.roles.includes(user.role));
  const isOperation = !['/dashboard', '/facturas', '/proveedores', '/gastos', '/ubicacion'].includes(path);

  return (
    <View style={{ flex: 1, backgroundColor: colors.face }}>
      <View style={[styles.head, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.word}>MIRADOR</Text>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{user ? ROLE[user.role] : ''}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
        {items.map((i) => {
          const on = i.href === '/' ? isOperation : path === i.href;
          return (
            <Pressable
              key={i.href}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => router.navigate(i.href)}
              style={[styles.item, on && styles.itemOn]}
            >
              <MaterialCommunityIcons name={i.icon} size={22} color={on ? colors.onLight : colors.ink2} />
              <Text style={[styles.itemText, on && { color: colors.onLight }]}>{i.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        style={[styles.item, { marginBottom: insets.bottom + 12 }]}
        accessibilityRole="button"
        onPress={() =>
          Alert.alert('Cambiar de perfil', '¿Cerrar la sesión en este celular?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
          ])
        }
      >
        <MaterialCommunityIcons name="logout" size={22} color={colors.ink2} />
        <Text style={styles.itemText}>Cambiar de perfil</Text>
      </Pressable>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={() => <DrawerContent />}
      screenOptions={{ ...headerOptions, drawerStyle: { backgroundColor: colors.face, width: 300 }, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Drawer.Screen name="(tabs)" options={{ headerShown: false, title: 'Operación' }} />
      <Drawer.Screen name="dashboard" options={{ title: 'Resumen del negocio' }} />
      <Drawer.Screen name="facturas" options={{ title: 'Facturas' }} />
      <Drawer.Screen name="proveedores" options={{ title: 'Proveedores' }} />
      <Drawer.Screen name="gastos" options={{ title: 'Gastos' }} />
      <Drawer.Screen name="ubicacion" options={{ title: 'Ubicación' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: colors.shell, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 4, borderBottomColor: colors.trim },
  word: { color: colors.ink, fontSize: 24, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  role: { color: colors.steel, fontSize: 13, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 20, marginRight: 12, borderTopRightRadius: 26, borderBottomRightRadius: 26 },
  itemOn: { backgroundColor: colors.ink },
  itemText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
