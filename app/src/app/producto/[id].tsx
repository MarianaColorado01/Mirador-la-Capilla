import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { ProductOwnerView } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, MoneyRow, Tag } from '@/components/ui';
import { useMovements, useProduct } from '@/hooks/queries';
import { useSession } from '@/store/session';
import { colors, space, type } from '@/theme';
import { dateTime, money } from '@/utils/format';

const TYPE = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' } as const;

/** RF-12: detalle del producto. El dueño ve además costo, margen y movimientos (RF-49, RF-60). */
export default function ProductoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const owner = useSession((s) => s.user?.role === 'dueno');
  const product = useProduct(pid);
  const moves = useMovements(pid, owner);

  if (product.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (product.isError) {
    const notFound = (product.error as Error).message === 'Producto no encontrado';
    return (
      <Screen>
        {notFound ? (
          <StateView kind="empty" icon="bottle-wine-outline" title="Producto no encontrado" message="Puede que el enlace sea viejo." action={{ label: 'Volver', onPress: () => router.back() }} />
        ) : (
          <StateView kind="error" message={(product.error as Error).message} onRetry={() => product.refetch()} />
        )}
      </Screen>
    );
  }

  const p = product.data;
  const o = owner ? (p as ProductOwnerView) : null;
  const low = p.stock <= p.minStock;

  return (
    <Screen
      footer={
        owner ? (
          <View style={styles.two}>
            <View style={{ flex: 1 }}><AppButton label="Ajustar stock" icon="tune-variant" variant="outline" onPress={() => router.push({ pathname: '/inventario/ajuste', params: { productId: String(p.id) } })} /></View>
            <View style={{ flex: 1 }}><AppButton label="Editar" icon="pencil" onPress={() => router.push({ pathname: '/producto/editar', params: { id: String(p.id) } })} /></View>
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: p.name }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{p.name}</Text>
          <Text style={type.small}>{p.categoryName}</Text>
        </View>
        {!p.active ? <Tag label="Inactivo" color={colors.ink3} /> : low ? <Tag label="Stock bajo" color={colors.red} /> : <Tag label="Activo" color={colors.green} />}
      </View>

      <View style={styles.two}>
        <Card style={{ flex: 1 }}>
          <View style={styles.box}><Text style={type.label}>Stock</Text><Text style={[type.figure, low && { color: colors.red }]}>{p.stock}</Text></View>
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={styles.box}><Text style={type.label}>Mínimo</Text><Text style={type.figure}>{p.minStock}</Text></View>
        </Card>
      </View>

      <Card>
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <MoneyRow label="Precio de venta" value={p.price} />
          {o && <MoneyRow label="Último costo" value={o.cost} />}
          {o && <MoneyRow label="Margen por unidad" value={`${money(o.margin)} · ${Math.round((o.margin / o.price) * 100)} %`} />}
        </View>
      </Card>

      {owner && (
        <Card title="Movimientos" right={<Text style={type.label}>Quién</Text>}>
          {moves.isPending ? (
            <StateView kind="loading" />
          ) : moves.isError ? (
            <StateView kind="error" message={(moves.error as Error).message} onRetry={() => moves.refetch()} />
          ) : !moves.data.length ? (
            <Text style={[type.small, { padding: space.lg }]}>Sin movimientos todavía.</Text>
          ) : (
            moves.data.map((m) => (
              <View key={m.id} style={styles.move}>
                <Text style={[styles.qty, { color: m.qty > 0 ? colors.green : colors.ink }]}>{m.qty > 0 ? `+${m.qty}` : m.qty}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{TYPE[m.type]}{m.reason ? ` · ${m.reason}` : ''}</Text>
                  <Text style={type.small}>{dateTime(m.createdAt)}{m.reference ? ` · ${m.reference}` : ''}</Text>
                </View>
                <Text style={type.label}>{m.user ?? '—'}</Text>
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  two: { flexDirection: 'row', gap: space.sm },
  box: { padding: space.lg, gap: 4 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  qty: { minWidth: 40, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] },
});
