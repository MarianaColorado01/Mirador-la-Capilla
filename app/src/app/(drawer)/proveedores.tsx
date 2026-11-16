import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Tag } from '@/components/ui';
import { useSuppliers } from '@/hooks/queries';
import { colors, space, type } from '@/theme';

/** RF-52: proveedores del dueño (activos primero). Desde aquí se registra una compra (RF-53). */
export default function Proveedores() {
  const suppliers = useSuppliers();
  const list = suppliers.data ?? [];
  const add = () => router.push({ pathname: '/proveedor/[id]', params: { id: 'nuevo' } });

  return (
    <Screen refreshing={suppliers.isRefetching} onRefresh={() => suppliers.refetch()}>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <AppButton label="Nuevo proveedor" icon="plus" variant="outline" onPress={add} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton label="Registrar compra" icon="cart-plus" onPress={() => router.push('/compra/nueva')} disabled={!list.some((s) => s.active)} />
        </View>
      </View>
      {suppliers.isPending ? (
        <StateView kind="loading" />
      ) : suppliers.isError && !suppliers.data ? (
        <StateView kind="error" message={suppliers.error.message} onRetry={() => suppliers.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="truck-outline" title="Aún no hay proveedores" action={{ label: 'Crear proveedor', onPress: add }} />
      ) : (
        <Card title={`${list.filter((s) => s.active).length} activos`}>
          {list.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push({ pathname: '/proveedor/[id]', params: { id: String(s.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}${s.phone ? `, teléfono ${s.phone}` : ''}${s.active ? '' : ', inactivo'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !s.active && { color: colors.ink3 }]}>{s.name}</Text>
                {(s.phone || s.address) && <Text style={type.small}>{[s.phone, s.address].filter(Boolean).join(' · ')}</Text>}
              </View>
              {!s.active && <Tag label="Inactivo" color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 60, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
});
