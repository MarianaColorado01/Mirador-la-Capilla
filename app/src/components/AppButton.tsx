import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

type Variant = 'primary' | 'outline' | 'danger' | 'text';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}

/** Botón único de la app (lineamiento: componente reutilizable con props tipadas). */
export function AppButton({ label, onPress, variant = 'primary', icon, disabled, loading, compact }: AppButtonProps) {
  const off = disabled || loading;
  const fg = off ? colors.ink3 : variant === 'primary' ? colors.onLight : variant === 'danger' ? '#FFFFFF' : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        off && styles.off,
        pressed && !off && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <MaterialCommunityIcons name={icon} size={20} color={fg} />}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 42, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  primary: { backgroundColor: colors.ink, borderBottomWidth: 3, borderBottomColor: colors.trim },
  outline: { borderWidth: 1, borderColor: colors.ink3 },
  danger: { backgroundColor: '#D9423B' },
  text: { minHeight: 44, paddingHorizontal: 8 },
  off: { backgroundColor: colors.face2, borderColor: colors.line, borderBottomColor: colors.line, borderWidth: 1 },
});
