import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnection } from '@/hooks/queries';
import { useSession } from '@/store/session';
import { colors, space } from '@/theme';
import { Banner } from './ui';

const STRIP_TEXT = 'font-display text-[12px] tracking-[1.2px] uppercase';

export const ROLE_LABEL = { todo: 'Todo en uno', mesero: 'Mesero', barra: 'Barra', caja: 'Caja', dueno: 'Dueño' } as const;

/** Franja bajo la barra superior: quién opera y el indicador de conexión (RF-03). */
export function ConnectionStrip() {
  const user = useSession((s) => s.user);
  const conn = useConnection();
  const color = conn === 'ok' ? colors.green : conn === 'off' ? colors.red : colors.amber;
  const label = { ok: 'Conectado', reconnecting: 'Reconectando', off: 'Sin conexión', checking: 'Conectando' }[conn];
  return (
    <View className="flex-row justify-between items-center px-lg h-[34px] bg-shell2 border-b-[3px] border-b-trim">
      <Text className={`${STRIP_TEXT} text-ink2`}>{user ? `${user.name} · ${ROLE_LABEL[user.role]}` : 'Mirador La Capilla'}</Text>
      <View className="flex-row items-center gap-[6px]">
        <View className="w-[8px] h-[8px] rounded-[4px]" style={{ backgroundColor: color }} />
        <Text className={STRIP_TEXT} style={{ color }}>{label}</Text>
      </View>
    </View>
  );
}

interface ScreenProps {
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sin franja de conexión (p. ej. pantallas antes de iniciar sesión). */
  bare?: boolean;
}

/** Marco común: franja de conexión, aviso sin conexión (RF-67), contenido desplazable y pie fijo. */
export function Screen({ children, footer, refreshing, onRefresh, bare }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const conn = useConnection();
  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!bare && <ConnectionStrip />}
      <ScrollView
        contentContainerClassName="p-lg gap-lg pb-[40px]"
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink2} /> : undefined}
      >
        {!bare && conn === 'off' && (
          <Banner tone="red" icon="wifi-off" title="Sin conexión con el PC de caja" text="Las confirmaciones están deshabilitadas. Reintentando…" />
        )}
        {children}
      </ScrollView>
      {footer && <View className="p-md gap-sm bg-face border-t border-t-line" style={{ paddingBottom: space.md + insets.bottom }}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}
