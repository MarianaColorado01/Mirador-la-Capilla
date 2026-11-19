import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive, type Notice } from '@/store/live';
import { colors } from '@/theme';

// Sombra con los valores exactos de cada plataforma (elevation es solo de Android).
const SHADOW = { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 };
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
      className="flex-row items-center gap-md p-[14px] rounded-md bg-shell border border-line border-l-4"
      style={{ borderLeftColor: TONE[n.tone], ...SHADOW }}
    >
      <MaterialCommunityIcons name={n.icon} size={22} color={TONE[n.tone]} />
      <View className="flex-1">
        <Text className="font-body-bold text-[15px] text-ink">{n.title}</Text>
        {n.text ? <Text className="font-body text-[13px] text-ink2 mt-[2px]">{n.text}</Text> : null}
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
    <View pointerEvents="box-none" className="absolute left-md right-md gap-sm" style={{ top: insets.top + 8 }}>
      {notices.map((n) => (
        <NoticeCard key={n.id} n={n} />
      ))}
    </View>
  );
}
