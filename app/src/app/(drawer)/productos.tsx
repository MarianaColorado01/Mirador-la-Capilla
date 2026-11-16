import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Tag } from '@/components/ui';
import { useAllProducts } from '@/hooks/queries';
import { colors, radius, type } from '@/theme';
import { money } from '@/utils/format';

/** RF-13 / RF-14: lista de productos del dueño, con los inactivos, búsqueda y filtro por categoría (RF-11). */
export default function Productos() {
  const products = useAllProducts();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const list = products.data ?? [];
  const categories = useMemo(() => ['Todas', ...new Set((products.data ?? []).map((p) => p.categoryName))], [products.data]);
  const shown = list.filter((p) => (cat === 'Todas' || p.categoryName === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <Screen
      refreshing={products.isRefetching}
      onRefresh={() => products.refetch()}
      footer={<AppButton label="Nuevo producto" icon="plus" onPress={() => router.push('/producto/editar')} />}
    >
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
        <StateView kind="loading" message="Cargando productos…" />
      ) : products.isError && !products.data ? (
        <StateView kind="error" message={products.error.message} onRetry={() => products.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="bottle-wine-outline" title="Aún no hay productos" action={{ label: 'Crear producto', onPress: () => router.push('/producto/editar') }} />
      ) : shown.length === 0 ? (
        <StateView kind="empty" icon="magnify" title="Nada coincide con la búsqueda" action={{ label: 'Quitar filtros', onPress: () => { setQ(''); setCat('Todas'); } }} />
      ) : (
        <Card title={`${shown.length} ${shown.length === 1 ? 'producto' : 'productos'}`}>
          {shown.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push(`/producto/${p.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${money(p.price)}, stock ${p.stock}${p.active ? '' : ', inactivo'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !p.active && { color: colors.ink3 }]}>{p.name}</Text>
                <Text style={type.small}>
                  {p.categoryName} · {money(p.price)} · <Text style={p.outOfStock ? styles.out : p.lowStock ? styles.low : undefined}>stock {p.stock}</Text>
                </Text>
              </View>
              {!p.active && <Tag label="Inactivo" color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  low: { color: colors.amber, fontWeight: '700' },
  out: { color: colors.red, fontWeight: '700' },
});
