import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StockMovement } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, MoneyRow, Tag } from '@/components/ui';
import { useMovements, useProduct } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';
import { dateTime, money } from '@/utils/format';

const MOVE: Record<StockMovement['type'], string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };
const FILTERS: { value: 'todos' | StockMovement['type']; label: string }[] = [{ value: 'todos', label: 'Todos' }, ...(Object.keys(MOVE) as StockMovement['type'][]).map((t) => ({ value: t, label: MOVE[t] }))];

/** RF-12: detalle del producto. El dueño ve además costo, margen y movimientos de stock filtrables por tipo (RF-49). */
export default function ProductoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const isOwner = useSession((s) => s.user!.role === 'dueno');
  const product = useProduct(productId);
  const [filter, setFilter] = useState<'todos' | StockMovement['type']>('todos');
  const movements = useMovements(productId, isOwner && product.isSuccess, filter === 'todos' ? undefined : filter);

  // Id no numérico (la consulta ni corre) o el servidor responde 404: nunca se queda cargando.
  const notFound = !(Number.isInteger(productId) && productId > 0) || (product.error instanceof ApiError && product.error.status === 404);
  if (notFound)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Producto' }} />
        <StateView kind="empty" icon="bottle-wine-outline" title="Producto no encontrado" message="Puede que el enlace esté mal o que el producto no exista." action={{ label: 'Volver', onPress: () => router.back() }} />
      </Screen>
    );
  if (product.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (product.isError) return <Screen><StateView kind="error" message={product.error.message} onRetry={() => product.refetch()} /></Screen>;

  const p = product.data;
  return (
    <Screen
      refreshing={product.isRefetching}
      onRefresh={() => { product.refetch(); if (isOwner) movements.refetch(); }}
      footer={
        isOwner ? (
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <AppButton label="Ajustar stock" icon="swap-vertical" variant="outline" onPress={() => router.push({ pathname: '/producto/ajuste', params: { id: p.id } })} />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton label="Editar" icon="pencil-outline" onPress={() => router.push({ pathname: '/producto/editar', params: { id: p.id } })} />
            </View>
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: p.name }} />
      <View style={styles.head}>
        <View style={styles.photo}>
          {p.imageSource ? (
            <Image source={p.imageSource} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Foto de ${p.name}`} />
          ) : (
            <MaterialCommunityIcons name="bottle-wine-outline" size={44} color={colors.ink3} />
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={type.title}>{p.name}</Text>
          <Text style={type.small}>{p.categoryName}</Text>
          <View style={styles.tags}>
            {!p.active && <Tag label="Inactivo" color={colors.ink3} />}
            {p.outOfStock ? <Tag label="Agotado" color={colors.red} /> : p.lowStock ? <Tag label="Stock bajo" color={colors.amber} /> : null}
          </View>
        </View>
      </View>

      <Card>
        <View style={styles.block}>
          <MoneyRow label="Precio" value={p.price} />
          <MoneyRow label="Stock" value={`${p.stock} ${p.stock === 1 ? 'unidad' : 'unidades'}`} />
          <MoneyRow label="Stock mínimo" value={String(p.minStock)} />
          {p.cost !== null && p.margin !== null && (
            <>
              <MoneyRow label="Costo" value={p.cost} />
              <MoneyRow label="Margen" value={`${money(p.margin)} · ${Math.round((p.margin / p.price) * 100)} %`} strong />
            </>
          )}
        </View>
      </Card>

      {isOwner && (
        <Card title="Últimos movimientos de stock">
          <View style={styles.filter}>
            <Chips options={FILTERS} value={filter} onChange={setFilter} />
          </View>
          {movements.isPending ? (
            <StateView kind="loading" />
          ) : movements.isError ? (
            <StateView kind="error" message={movements.error.message} onRetry={() => movements.refetch()} />
          ) : movements.data.length === 0 ? (
            <StateView kind="empty" icon="swap-vertical" title={filter === 'todos' ? 'Sin movimientos' : `Sin movimientos de tipo ${MOVE[filter].toLowerCase()}`} message="El stock sube con una compra o un ajuste de inventario." />
          ) : (
            movements.data.map((m) => (
              <View key={m.id} style={styles.move}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{MOVE[m.type]}{m.reason ? ` · ${m.reason}` : ''}</Text>
                  <Text style={type.small}>{dateTime(m.createdAt)} · {m.user ?? '—'}{m.reference ? ` · ${m.reference}` : ''}</Text>
                </View>
                <Text style={[styles.qty, { color: m.qty < 0 ? colors.red : colors.green }]}>{m.qty > 0 ? `+${m.qty}` : `−${Math.abs(m.qty)}`}</Text>
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  photo: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.face2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tags: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  footer: { flexDirection: 'row', gap: space.md },
  filter: { paddingHorizontal: 14, paddingBottom: space.sm },
  block: { paddingHorizontal: 14, paddingVertical: 4 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  qty: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
