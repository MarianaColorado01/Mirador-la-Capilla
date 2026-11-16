import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Drawer, DrawerContentScrollView, DrawerItem, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';
import { Alert, StyleSheet, Text, View, type ColorValue } from 'react-native';
import type { Role } from '@mirador/shared';
import { ROLE_LABEL } from '@/components/Screen';
import { useSettings } from '@/hooks/queries';
import { useSession } from '@/store/session';
import { colors, headerOptions, space, type } from '@/theme';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * RF-06: opciones del menú lateral según el rol. Para agregar una, crea `(drawer)/<name>.tsx`
 * y súmala aquí; el servidor igual niega lo que el rol no puede hacer (RN-09).
 */
const ENTRIES: { name: string; title: string; icon: Icon; roles: Role[] }[] = [
  { name: 'facturas', title: 'Facturas', icon: 'receipt', roles: ['todo', 'caja', 'dueno'] },
  { name: 'ajustes', title: 'Ajustes', icon: 'cog-outline', roles: ['dueno'] },
  { name: 'usuarios', title: 'Usuarios', icon: 'account-group-outline', roles: ['dueno'] },
];

const icon = (name: Icon) =>
  function DrawerIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  };

function Content(props: DrawerContentComponentProps) {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const business = useSettings().data?.businessName ?? 'Mirador La Capilla';
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={styles.head}>
        <Text style={type.h}>{business}</Text>
        {user && <Text style={type.small}>{user.name} · {ROLE_LABEL[user.role]}</Text>}
      </View>
      <DrawerItemList {...props} />
      <View style={styles.sep} />
      <DrawerItem
        label="Cambiar de perfil"
        icon={icon('account-switch-outline')}
        inactiveTintColor={colors.ink2}
        labelStyle={styles.label}
        accessibilityLabel="Cambiar de perfil"
        onPress={() =>
          Alert.alert('Cambiar de perfil', '¿Cerrar la sesión en este celular?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
          ])
        }
      />
    </DrawerContentScrollView>
  );
}

/** Menú lateral con las pestañas adentro. Las opciones que el rol no puede usar no existen (Drawer.Protected). */
export default function DrawerLayout() {
  const role = useSession((s) => s.user?.role ?? 'mesero');
  return (
    <Drawer
      drawerContent={(props) => <Content {...props} />}
      screenOptions={{
        ...headerOptions,
        drawerStyle: { backgroundColor: colors.face, width: 290 },
        drawerActiveTintColor: colors.onLight,
        drawerActiveBackgroundColor: colors.ink,
        drawerInactiveTintColor: colors.ink2,
        drawerLabelStyle: styles.label,
        drawerItemStyle: { borderRadius: 10, minHeight: 48 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: 'Inicio', headerShown: false, drawerIcon: icon('home-outline') }} />
      {ENTRIES.map((e) => (
        <Drawer.Protected key={e.name} guard={e.roles.includes(role)}>
          <Drawer.Screen name={e.name} options={{ title: e.title, drawerIcon: icon(e.icon) }} />
        </Drawer.Protected>
      ))}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2, paddingHorizontal: space.lg, paddingTop: space.xl + space.lg, paddingBottom: space.lg, marginBottom: space.sm, backgroundColor: colors.shell, borderBottomWidth: 3, borderBottomColor: colors.trim },
  label: { fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 13 },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: space.sm, marginHorizontal: space.lg },
});
