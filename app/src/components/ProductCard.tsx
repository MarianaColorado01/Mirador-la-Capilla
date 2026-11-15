import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@mirador/shared';
import { colors, radius } from '@/theme';
import { money } from '@/utils/format';

export interface ProductCardProps {
  product: Product;
  /** Unidades ya agregadas a la ronda en construcción. */
  inRound: number;
  onAdd: (p: Product) => void;
}

/** Tarjeta de producto con imagen o imagen alternativa (RF-10). */
export function ProductCard({ product: p, inRound, onAdd }: ProductCardProps) {
  const out = p.stock <= 0;
  const left = p.stock - inRound;
  const low = !out && p.stock <= p.minStock;
  return (
    <View style={[styles.row, out && { opacity: 0.55 }]}>
      <View style={styles.thumb}>
        {p.imageUrl ? (
          <Image source={p.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <MaterialCommunityIcons name="bottle-wine-outline" size={26} color={colors.ink3} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{p.name}</Text>
        <Text style={styles.meta}>
          {money(p.price)} ·{' '}
          <Text style={out ? styles.out : low ? styles.low : undefined}>
            {out ? 'Agotado' : `${p.stock} ${p.stock === 1 ? 'disponible' : 'disponibles'}`}
          </Text>
        </Text>
      </View>
      {!out && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${p.name}`}
          disabled={left <= 0}
          onPress={() => onAdd(p)}
          style={[styles.add, left <= 0 && { opacity: 0.4 }]}
        >
          {inRound > 0 ? <Text style={styles.count}>{inRound}</Text> : <MaterialCommunityIcons name="plus" size={22} color={colors.ink} />}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 66 },
  thumb: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.face2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.ink3, fontSize: 13, marginTop: 2 },
  low: { color: colors.amber, fontWeight: '700' },
  out: { color: colors.red, fontWeight: '700' },
  add: { width: 46, height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.ink, fontSize: 17, fontWeight: '800' },
});
