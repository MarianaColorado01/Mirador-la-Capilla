import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '@/theme';
import { AppButton } from './AppButton';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'empty'; title: string; message?: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; action?: { label: string; onPress: () => void } };

const BOX = 'items-center justify-center gap-sm py-[36px] px-lg';
const TITLE = 'font-display text-[17px] tracking-[0.6px] text-ink text-center';
const SMALL = 'font-body text-[13px] text-ink3 text-center';

/** Carga, error con Reintentar y vacío para toda consulta remota (RF-68). */
export function StateView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <View className={BOX}>
        <ActivityIndicator color={colors.ink2} />
        <Text className={SMALL}>{props.message ?? 'Cargando…'}</Text>
      </View>
    );
  }
  if (props.kind === 'error') {
    return (
      <View className={BOX}>
        <MaterialCommunityIcons name="wifi-off" size={28} color={colors.red} />
        <Text className={TITLE}>No se pudo cargar</Text>
        <Text className={SMALL}>{props.message}</Text>
        <AppButton label="Reintentar" icon="refresh" variant="outline" compact onPress={props.onRetry} />
      </View>
    );
  }
  return (
    <View className={BOX}>
      <MaterialCommunityIcons name={props.icon ?? 'inbox-outline'} size={28} color={colors.ink3} />
      <Text className={TITLE}>{props.title}</Text>
      {props.message && <Text className={SMALL}>{props.message}</Text>}
      {props.action && <AppButton label={props.action.label} variant="outline" compact onPress={props.action.onPress} />}
    </View>
  );
}
