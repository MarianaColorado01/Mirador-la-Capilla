import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnection } from '@/hooks/queries';
import { useSession } from '@/store/session';
import { colors, space } from '@/theme';
import { Banner } from './ui';

export const ROLE_LABEL = { todo: 'Todo en uno', mesero: 'Mesero', barra: 'Barra', caja: 'Caja', dueno: 'Dueño' } as const;

/** Franja bajo la barra superior: quién opera y el indicador de conexión (RF-03). */
export function ConnectionStrip() {
  const user = useSession((s) => s.user);
  const conn = useConnection();
  const color = conn === 'ok' ? colors.green : conn === 'off' ? colors.red : colors.amber;
  const label = { ok: 'Conectado', reconnecting: 'Reconectando', off: 'Sin conexión', checking: 'Conectando' }[conn];
  return (
    <View style={styles.strip}>
      <Text style={styles.who}>{user ? `${user.name} · ${ROLE_LABEL[user.role]}` : 'Mirador La Capilla'}</Text>
      <View style={styles.lamp}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.lampText, { color }]}>{label}</Text>
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!bare && <ConnectionStrip />}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink2} /> : undefined}
      >
        {!bare && conn === 'off' && (
          <Banner tone="red" icon="wifi-off" title="Sin conexión con el PC de caja" text="Las confirmaciones están deshabilitadas. Reintentando…" />
        )}
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: space.md + insets.bottom }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  strip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 34,
    backgroundColor: colors.shell2, borderBottomWidth: 3, borderBottomColor: colors.trim,
  },
  who: { color: colors.ink2, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  lamp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lampText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 40 },
  footer: { padding: space.md, gap: space.sm, backgroundColor: colors.face, borderTopWidth: 1, borderTopColor: colors.line },
});
