import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, MoneyRow, Tag } from '@/components/ui';
import { usePurchases, useSupplier } from '@/hooks/queries';
import { colors, space, type } from '@/theme';
import { money, shortDate } from '@/utils/format';

/** RF-52 detalle · RF-55 compras de este proveedor · RF-66 verlo en el mapa. */
function Proveedor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = Number(id);
  const sup = useSupplier(sid);
  const purchases = usePurchases({ supplierId: sid });

  if (sup.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (sup.isError) {
    const notFound = (sup.error as Error).message === 'Proveedor no encontrado';
    return (
      <Screen>
        {notFound ? (
          <StateView kind="empty" icon="truck-outline" title="Proveedor no encontrado" action={{ label: 'Volver', onPress: () => router.back() }} />
        ) : (
          <StateView kind="error" message={(sup.error as Error).message} onRetry={() => sup.refetch()} />
        )}
      </Screen>
    );
  }
  const s = sup.data;

  return (
    <Screen
      footer={
        <View style={styles.two}>
          <View style={{ flex: 1 }}><AppButton label="Editar" icon="pencil" variant="outline" onPress={() => router.push({ pathname: '/proveedor/editar', params: { id: String(s.id) } })} /></View>
          <View style={{ flex: 1 }}><AppButton label="Nueva compra" icon="truck-plus-outline" onPress={() => router.push({ pathname: '/compra/nueva', params: { supplierId: String(s.id) } })} /></View>
        </View>
      }
    >
      <Stack.Screen options={{ title: s.name }} />
      <View style={styles.head}>
        <Text style={[type.title, { flex: 1 }]}>{s.name}</Text>
        {!s.active && <Tag label="Inactivo" color={colors.ink3} />}
      </View>
      <Card>
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <MoneyRow label="Teléfono" value={s.phone || '—'} />
          <MoneyRow label="Dirección" value={s.address || '—'} />
          <MoneyRow label="Notas" value={s.notes || '—'} />
          <MoneyRow label="Coordenadas" value={s.lat != null ? `${s.lat.toFixed(4)}, ${s.lng!.toFixed(4)}` : 'Sin registrar'} />
        </View>
      </Card>
      <View style={styles.two}>
        {s.phone ? <View style={{ flex: 1 }}><AppButton label="Llamar" icon="phone" variant="outline" compact onPress={() => Linking.openURL(`tel:${s.phone.replace(/\s/g, '')}`)} /></View> : null}
        <View style={{ flex: 1 }}>
          <AppButton
            label="Ver en el mapa"
            icon="map-marker"
            variant="outline"
            compact
            disabled={s.lat == null}
            onPress={() => router.navigate({ pathname: '/ubicacion', params: { supplierId: String(s.id) } })}
          />
        </View>
      </View>

      <Card title="Compras a este proveedor">
        {purchases.isPending ? (
          <StateView kind="loading" />
        ) : purchases.isError ? (
          <StateView kind="error" message={(purchases.error as Error).message} onRetry={() => purchases.refetch()} />
        ) : !purchases.data.length ? (
          <Text style={[type.small, { padding: space.lg }]}>Todavía no hay compras.</Text>
        ) : (
          purchases.data.map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={styles.date}>{shortDate(p.date)}</Text>
              <Text style={[type.small, { flex: 1 }]} numberOfLines={2}>{p.items.map((i) => `${i.qty} ${i.productName}`).join(' · ')}</Text>
              <Text style={styles.total}>{money(p.total)}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

export default function ProveedorScreen() {
  return <RoleGate roles={['dueno']}><Proveedor /></RoleGate>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  two: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line2 },
  date: { color: colors.ink, fontWeight: '700', minWidth: 44 },
  total: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
