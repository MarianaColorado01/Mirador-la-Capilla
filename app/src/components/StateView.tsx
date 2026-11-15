import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/theme';
import { AppButton } from './AppButton';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'empty'; title: string; message?: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; action?: { label: string; onPress: () => void } };

/** Carga, error con Reintentar y vacío para toda consulta remota (RF-68). */
export function StateView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.ink2} />
        <Text style={type.small}>{props.message ?? 'Cargando…'}</Text>
      </View>
    );
  }
  if (props.kind === 'error') {
    return (
      <View style={styles.box}>
        <MaterialCommunityIcons name="wifi-off" size={28} color={colors.red} />
        <Text style={[type.h, styles.center]}>No se pudo cargar</Text>
        <Text style={[type.small, styles.center]}>{props.message}</Text>
        <AppButton label="Reintentar" icon="refresh" variant="outline" compact onPress={props.onRetry} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <MaterialCommunityIcons name={props.icon ?? 'inbox-outline'} size={28} color={colors.ink3} />
      <Text style={[type.h, styles.center]}>{props.title}</Text>
      {props.message && <Text style={[type.small, styles.center]}>{props.message}</Text>}
      {props.action && <AppButton label={props.action.label} variant="outline" compact onPress={props.action.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: 36, paddingHorizontal: space.lg },
  center: { textAlign: 'center' },
});
