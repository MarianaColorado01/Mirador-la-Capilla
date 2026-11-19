import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Tag } from '@/components/ui';
import { useInventory, useSuggestions } from '@/hooks/queries';
import { colors, radius, space, type } from '@/theme';

type Filter = 'todos' | 'inactivos' | 'solo_agotados';

/** RF-47: stock con los productos en o bajo el mínimo primero. RF-50 aviso. RF-51 sugerencia de surtido. */
function Inventario() {
  const inv = useInventory();
  const sug = useSuggestions();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const list = inv.data ?? [];
  const low = list.filter((p) => p.active && p.low);
  const shown = list.filter(
    (p) =>
      
      (filter === 'todos' ?  p.active :filter === 'solo_agotados' ? p.active && p.low : !p.active) &&
      (!q.trim() || `${p.name} ${p.categoryName}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <Screen refreshing={inv.isRefetching} onRefresh={() => { inv.refetch(); sug.refetch(); }}>
      {low.length > 0 && (
        <Banner tone="red" icon="bell-alert-outline" title={`${low.length} ${low.length === 0 ? 'producto' : 'productos'} en o bajo el mínimo`} text={low.map((p) => p.name).join(', ')} />
      )}

      {low.length > 0 && (
        <Banner tone="red" icon="bell-alert-outline" title={`${low.length} ${low.length === 0 ? 'producto' : 'productos'} sin stock`} text={low.map((p) => p.name).join(', ')} />
      )}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}><AppButton label="Ajustar" icon="tune-variant" variant="outline" compact onPress={() => router.push('/inventario/ajuste')} /></View>
        <View style={{ flex: 1 }}><AppButton label="Compra" icon="truck-plus-outline" variant="outline" compact onPress={() => router.push('/compra/nueva')} /></View>
      </View>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}><AppButton label="Producto" icon="plus" variant="outline" compact onPress={() => router.push('/producto/editar')} /></View>
        <View style={{ flex: 1 }}><AppButton label="Categorías" icon="shape-outline" variant="outline" compact onPress={() => router.push('/categorias')} /></View>
      </View>

      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Producto o categoría…" placeholderTextColor={colors.ink3} style={styles.searchInput} />
      </View>
      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'solo_agotados', label: `Solo agotados ${low.length} `},
          { value: 'inactivos', label: 'Inactivos' },
        ]}
      />

      {inv.isPending ? (
        <StateView kind="loading" message="Cargando inventario…" />
      ) : inv.isError && !inv.data ? (
        <StateView kind="error" message={(inv.error as Error).message} onRetry={() => inv.refetch()} />
      ) : shown.length === 0 ? (
        <StateView kind="empty" icon="package-variant" title="Nada en este filtro" action={{ label: 'Ver todos', onPress: () => { setFilter('todos'); setQ(''); } }} />
      ) : (
        <Card title="Producto · stock / mínimo">
          {shown.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/producto/[id]', params: { id: String(p.id) } })}
              style={({ pressed }) => [styles.row, p.low && p.active && { backgroundColor: colors.redBg }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{p.name}</Text>
                <Text style={type.small}>{p.categoryName}{p.active ? '' : ' · inactivo'}</Text>
              </View>
              <Text style={[styles.stock, p.low && p.active && { color: colors.red }]}>{p.stock}</Text>
              <Text style={type.small}>/ {p.minStock}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}

      <Card title="Sugerencia de surtido" right={<Tag label="Últimos 7 días" />}>
        {sug.isPending ? (
          <StateView kind="loading" />
        ) : !sug.data?.length ? (
          <Text style={[type.small, { padding: space.lg }]}>No hay nada urgente por surtir.</Text>
        ) : (
          <>
            {sug.data.map((s) => (
              <View key={s.productId} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{s.name}</Text>
                  <Text style={type.small}>Stock {s.stock} · mínimo {s.minStock} · vendió {s.soldLast7Days}</Text>
                </View>
                <Text style={styles.suggest}>pedir {s.suggestedQty}</Text>
              </View>
            ))}
            <View style={{ padding: space.md }}>
              <AppButton label="Crear compra con esto" icon="truck-outline" variant="outline" compact onPress={() => router.push({ pathname: '/compra/nueva', params: { sugerencias: '1' } })} />
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

export default function InventarioTab() {
  return (
    <RoleGate roles={['dueno']}>
      <Inventario />
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 58, borderTopWidth: 1, borderTopColor: colors.line2 },
  stock: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  suggest: { color: colors.ink, fontWeight: '800', fontSize: 15 },
});
