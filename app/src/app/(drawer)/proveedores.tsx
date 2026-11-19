import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Tag } from '@/components/ui';
import { useSuppliers } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money, shortDate } from '@/utils/format';

/** RF-52: lista de proveedores. Desde aquí se registran compras y se ve el historial. */
function Proveedores() {
  const sup = useSuppliers(true);
  return (
    <Screen
      refreshing={sup.isRefetching}
      onRefresh={() => sup.refetch()}
      footer={
        <View style={styles.two}>
          <View style={{ flex: 1 }}><AppButton label="Compras" icon="history" variant="outline" onPress={() => router.push('/compras')} /></View>
          <View style={{ flex: 1 }}><AppButton label="Nueva compra" icon="truck-plus-outline" onPress={() => router.push('/compra/nueva')} /></View>
        </View>
      }
    >
      <AppButton label="Agregar proveedor" icon="plus" variant="outline" compact onPress={() => router.push('/proveedor/editar')} />
      {sup.isPending ? (
        <StateView kind="loading" />
      ) : sup.isError ? (
        <StateView kind="error" message={(sup.error as Error).message} onRetry={() => sup.refetch()} />
      ) : sup.data.length === 0 ? (
        <StateView kind="empty" icon="truck-outline" title="Aún no hay proveedores" message="Agrega el primero para registrar compras." />
      ) : (
        <Card>
          {sup.data.map((s) => (
            <Pressable key={s.id} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]} onPress={() => router.push({ pathname: '/proveedor/[id]', params: { id: String(s.id) } })} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }, !s.active && { color: colors.ink3 }]}>{s.name}</Text>
                <Text style={type.small}>
                  {s.phone || 'Sin teléfono'}
                  {s.lastPurchase ? ` · última compra ${shortDate(s.lastPurchase.date)} · ${money(s.lastPurchase.total)}` : ''}
                </Text>
              </View>
              {!s.active && <Tag label="Inactivo" color={colors.ink3} />}
              {s.lat != null && <MaterialCommunityIcons name="map-marker" size={18} color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function ProveedoresScreen() {
  return <RoleGate roles={['dueno']}><Proveedores /></RoleGate>;
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
});
