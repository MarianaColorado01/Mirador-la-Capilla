import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductModel } from '@/services/mappers';
import { colors } from '@/theme';
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
    <View className={`flex-row items-center gap-md px-[14px] py-[10px] min-h-[66px] ${out ? 'opacity-55' : ''}`}>
      {/* Solo la parte izquierda abre el detalle, así el botón + sigue siendo un control aparte. */}
      <Pressable
        onLongPress={onOpen && (() => onOpen(p))}
        disabled={!onOpen}
        accessibilityLabel={p.name}
        accessibilityHint={onOpen ? 'Mantén pulsado para ver el detalle' : undefined}
        accessibilityActions={onOpen ? [{ name: 'longpress', label: 'Ver detalle' }] : undefined}
        onAccessibilityAction={() => onOpen?.(p)}
        className="flex-1 flex-row items-center gap-md min-h-[46px]"
      >
        <View className="w-[46px] h-[46px] rounded-sm bg-face2 border border-line items-center justify-center overflow-hidden">
          {p.imageSource ? (
            <Image source={p.imageSource} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="bottle-wine-outline" size={26} color={colors.ink3} />
          )}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-body-semi text-[15px] text-ink">{p.name}</Text>
          <Text className="font-body text-[13px] text-ink3 mt-[2px]">
            {money(p.price)} ·{' '}
            <Text className={out ? 'font-body-bold text-red' : p.lowStock ? 'font-body-bold text-amber' : undefined}>
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
          className={`w-[46px] h-[46px] rounded-sm border border-line items-center justify-center ${left <= 0 ? 'opacity-40' : ''}`}
        >
          {inRound > 0 ? <Text className="font-display text-[19px] text-ink">{inRound}</Text> : <MaterialCommunityIcons name="plus" size={22} color={colors.ink} />}
        </Pressable>
      )}
    </View>
  );
}
