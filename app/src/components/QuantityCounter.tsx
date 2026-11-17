import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, Text, View } from 'react-native';
import { colors, tabular } from '@/theme';

export interface QuantityCounterProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** Se llama al intentar bajar de 1: quien lo usa pregunta si quita el ítem (RF-24). */
  onBelowMin: () => void;
}

const BTN = 'w-[46px] h-[46px] items-center justify-center';

/** Contador + / − con mínimo 1 y máximo igual al stock disponible (RF-24). */
export function QuantityCounter({ value, max, onChange, onBelowMin }: QuantityCounterProps) {
  const atMax = value >= max;
  return (
    <View className="flex-row items-center border border-line rounded-md bg-face" accessibilityRole="adjustable" accessibilityValue={{ min: 1, max, now: value }}>
      <Pressable className={BTN} accessibilityLabel="Restar" onPress={() => (value <= 1 ? onBelowMin() : onChange(value - 1))}>
        <MaterialCommunityIcons name="minus" size={22} color={colors.ink} />
      </Pressable>
      <Text className="min-w-[36px] text-center font-display text-[22px] text-ink" style={tabular}>{value}</Text>
      <Pressable className={BTN} accessibilityLabel="Sumar" disabled={atMax} onPress={() => onChange(value + 1)}>
        <MaterialCommunityIcons name="plus" size={22} color={atMax ? colors.line : colors.ink} />
      </Pressable>
    </View>
  );
}
