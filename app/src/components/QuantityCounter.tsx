import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

export interface QuantityCounterProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** Se llama al intentar bajar de 1: quien lo usa pregunta si quita el ítem (RF-24). */
  onBelowMin: () => void;
}

/** Contador + / − con mínimo 1 y máximo igual al stock disponible (RF-24). */
export function QuantityCounter({ value, max, onChange, onBelowMin }: QuantityCounterProps) {
  const atMax = value >= max;
  return (
    <View style={styles.box} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max, now: value }}>
      <Pressable style={styles.btn} accessibilityLabel="Restar" onPress={() => (value <= 1 ? onBelowMin() : onChange(value - 1))}>
        <MaterialCommunityIcons name="minus" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={styles.btn} accessibilityLabel="Sumar" disabled={atMax} onPress={() => onChange(value + 1)}>
        <MaterialCommunityIcons name="plus" size={22} color={atMax ? colors.line : colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.face },
  btn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 36, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});
