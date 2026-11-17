import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '@/theme';

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

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink border-b-[3px] border-b-trim',
  outline: 'border border-ink3',
  danger: 'bg-danger',
  text: '',
};

/** Botón único de la app (lineamiento: componente reutilizable con props tipadas). */
export function AppButton({ label, onPress, variant = 'primary', icon, disabled, loading, compact }: AppButtonProps) {
  const off = disabled || loading;
  const fg = off ? colors.ink3 : variant === 'primary' ? colors.onLight : variant === 'danger' ? '#FFFFFF' : colors.ink;
  const size = variant === 'text' ? 'min-h-[44px] px-sm' : compact ? 'min-h-[42px] px-[14px]' : 'min-h-[50px] px-[18px]';
  // Deshabilitado: fondo apagado; el primario conserva su borde inferior grueso, ahora gris.
  const look = off ? `bg-face2 border border-line ${variant === 'primary' ? 'border-b-[3px]' : ''}` : `${VARIANT[variant]} active:opacity-85`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      className={`rounded-md items-center justify-center ${size} ${look}`}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View className="flex-row items-center gap-sm">
          {icon && <MaterialCommunityIcons name={icon} size={20} color={fg} />}
          <Text className="font-display text-[15px] tracking-[1px] uppercase" style={{ color: fg }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
