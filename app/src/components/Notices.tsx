import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive, type Notice } from '@/store/live';
import { colors, radius } from '@/theme';

const TONE = { green: colors.green, amber: colors.amber, red: colors.red } as const;

function NoticeCard({ n }: { n: Notice }) {
  const dismiss = useLive((s) => s.dismiss);
  // Cada aviso se va solo a los 6 s; tocarlo lo cierra antes.
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), 6000);
    return () => clearTimeout(t);
  }, [n.id, dismiss]);

  return (
    <Pressable
      accessibilityRole="alert"
      onPress={() => {
        dismiss(n.id);
        if (n.accountId) router.push({ pathname: '/mesa/[id]', params: { id: String(n.accountId) } });
      }}
      style={[styles.card, { borderLeftColor: TONE[n.tone] }]}
    >
      <MaterialCommunityIcons name={n.icon} size={22} color={TONE[n.tone]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{n.title}</Text>
        {n.text ? <Text style={styles.text}>{n.text}</Text> : null}
      </View>
      <MaterialCommunityIcons name="close" size={18} color={colors.ink3} />
    </Pressable>
  );
}

/** Avisos que llegan en tiempo real, encima de cualquier pantalla. */
export function Notices() {
  const notices = useLive((s) => s.notices);
  const insets = useSafeAreaInsets();
  if (!notices.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + 8 }]}>
      {notices.map((n) => (
        <NoticeCard key={n.id} n={n} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 12, right: 12, gap: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md,
    backgroundColor: colors.shell, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  text: { color: colors.ink2, fontSize: 13, marginTop: 2 },
});
