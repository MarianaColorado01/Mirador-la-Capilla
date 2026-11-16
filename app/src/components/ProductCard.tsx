import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductModel } from '@/services/mappers';
import { colors, radius } from '@/theme';
import { money } from '@/utils/format';

export interface ProductCardProps {
  product: ProductModel;
  /** Unidades ya agregadas a la ronda en construcción. */
  inRound: number;
  onAdd: (p: ProductModel) => void;
  /** Pulsación larga: abre el detalle sin interferir con el toque de agregar (RF-12). */
  onOpen?: (p: ProductModel) => void;
}

/** Tarjeta de producto con imagen o imagen alternativa (RF-10). */
export function ProductCard({ product: p, inRound, onAdd, onOpen }: ProductCardProps) {
  const out = p.outOfStock;
  const left = p.stock - inRound;
  return (
    <View style={[styles.row, out && { opacity: 0.55 }]}>
      {/* Solo la parte izquierda abre el detalle, así el botón + sigue siendo un control aparte. */}
      <Pressable
        onLongPress={onOpen && (() => onOpen(p))}
        disabled={!onOpen}
        accessibilityLabel={p.name}
        accessibilityHint={onOpen ? 'Mantén pulsado para ver el detalle' : undefined}
        accessibilityActions={onOpen ? [{ name: 'longpress', label: 'Ver detalle' }] : undefined}
        onAccessibilityAction={() => onOpen?.(p)}
        style={styles.main}
      >
        <View style={styles.thumb}>
          {p.imageSource ? (
            <Image source={p.imageSource} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="bottle-wine-outline" size={26} color={colors.ink3} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.meta}>
            {money(p.price)} ·{' '}
            <Text style={out ? styles.out : p.lowStock ? styles.low : undefined}>
              {out ? 'Agotado' : `${p.stock} ${p.stock === 1 ? 'disponible' : 'disponibles'}`}
            </Text>
          </Text>
        </View>
      </Pressable>
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
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  thumb: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.face2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.ink3, fontSize: 13, marginTop: 2 },
  low: { color: colors.amber, fontWeight: '700' },
  out: { color: colors.red, fontWeight: '700' },
  add: { width: 46, height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.ink, fontSize: 17, fontWeight: '800' },
});
