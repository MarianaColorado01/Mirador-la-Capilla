import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Tag } from '@/components/ui';
import { useAllProducts, useStockSuggestions } from '@/hooks/queries';
import { colors, radius, space, type } from '@/theme';

/**
 * RF-47: stock de cada producto activo; primero los que están en o bajo el mínimo.
 * RF-51: arriba, qué surtir según stock bajo y lo más vendido en 7 días. Solo el dueño.
 */
export default function Inventario() {
  const products = useAllProducts();
  const suggestions = useStockSuggestions();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');

  const active = useMemo(() => (products.data ?? []).filter((p) => p.active), [products.data]);
  const categories = useMemo(() => ['Todas', ...new Set(active.map((p) => p.categoryName))], [active]);
  // sort es estable: dentro de cada grupo se conserva el orden del servidor (categoría, nombre).
  const shown = active
    .filter((p) => (cat === 'Todas' || p.categoryName === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.stock <= b.minStock) - Number(a.stock <= a.minStock));
  const lowCount = active.filter((p) => p.stock <= p.minStock).length;

  return (
    <Screen refreshing={products.isRefetching || suggestions.isRefetching} onRefresh={() => { products.refetch(); suggestions.refetch(); }}>
      <Card title="Qué surtir" right={<Text style={type.small}>últimos 7 días</Text>}>
        {suggestions.isPending ? (
          <StateView kind="loading" />
        ) : suggestions.isError ? (
          <StateView kind="error" message={suggestions.error.message} onRetry={() => suggestions.refetch()} />
        ) : suggestions.data.length === 0 ? (
          <StateView kind="empty" icon="check-circle-outline" title="Nada por surtir" message="Ningún producto está bajo el mínimo ni se está acabando por ventas." />
        ) : (
          <>
            <Text style={[type.small, styles.explain]}>Sugerido = lo que falta para llegar a 2 × el mínimo o a lo vendido en 7 días (lo mayor).</Text>
            {suggestions.data.map((s) => (
              <Pressable
                key={s.productId}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
                onPress={() => router.push(`/producto/${s.productId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}: comprar ${s.suggested}. Hay ${s.stock}, mínimo ${s.minStock}, vendidos ${s.sold7d} en 7 días`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={type.small}>Hay {s.stock} · mínimo {s.minStock} · vendidos {s.sold7d}</Text>
                </View>
                <Text style={styles.buy}>+{s.suggested}</Text>
              </Pressable>
            ))}
          </>
        )}
      </Card>

      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre…" placeholderTextColor={colors.ink3} style={styles.searchInput} accessibilityLabel="Buscar producto" />
        {!!q && (
          <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={20} color={colors.ink3} />
          </Pressable>
        )}
      </View>
      <Chips value={cat} onChange={setCat} options={categories.map((c) => ({ value: c, label: c }))} />

      {products.isPending ? (
        <StateView kind="loading" message="Cargando inventario…" />
      ) : products.isError && !products.data ? (
        <StateView kind="error" message={products.error.message} onRetry={() => products.refetch()} />
      ) : active.length === 0 ? (
        <StateView kind="empty" icon="package-variant" title="Aún no hay productos activos" action={{ label: 'Ir a productos', onPress: () => router.push('/productos') }} />
      ) : shown.length === 0 ? (
        <StateView kind="empty" icon="magnify" title="Nada coincide con la búsqueda" action={{ label: 'Quitar filtros', onPress: () => { setQ(''); setCat('Todas'); } }} />
      ) : (
        <Card title={`Stock · ${shown.length}`} right={lowCount > 0 ? <Tag label={`${lowCount} bajo mínimo`} color={colors.amber} /> : undefined}>
          {shown.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push(`/producto/${p.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, stock ${p.stock}, mínimo ${p.minStock}${p.outOfStock ? ', agotado' : p.lowStock ? ', stock bajo' : ''}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={type.small}>{p.categoryName} · mínimo {p.minStock}</Text>
              </View>
              {p.outOfStock ? <Tag label="Agotado" color={colors.red} /> : p.lowStock ? <Tag label="Bajo" color={colors.amber} /> : null}
              <Text style={[styles.stock, p.outOfStock ? styles.out : p.lowStock ? styles.low : undefined]}>{p.stock}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  explain: { paddingHorizontal: 14, paddingBottom: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 60, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  stock: { minWidth: 40, textAlign: 'right', color: colors.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  buy: { color: colors.green, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  low: { color: colors.amber },
  out: { color: colors.red },
});
