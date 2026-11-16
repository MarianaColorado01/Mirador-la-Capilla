/* Piezas pequeñas compartidas: etiquetas de estado, tarjetas, chips, filas de dinero y ítems. */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { RoundItem, RoundStatus } from '@mirador/shared';
import { colors, radius, space, type } from '@/theme';
import { money } from '@/utils/format';

export const ROUND_LABEL: Record<RoundStatus, string> = { tomado: 'Tomada', preparacion: 'Preparando', listo: 'Lista', entregado: 'Entregada' };
const ROUND_COLOR: Record<RoundStatus, string> = { tomado: colors.ink, preparacion: colors.amber, listo: colors.green, entregado: colors.ink3 };

export function Tag({ label, color = colors.ink2 }: { label: string; color?: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export const RoundTag = ({ status }: { status: RoundStatus }) => <Tag label={ROUND_LABEL[status]} color={ROUND_COLOR[status]} />;

export function Card({ children, title, right, style }: { children: ReactNode; title?: string; right?: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHead}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MoneyRow({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={strong ? styles.moneyStrongLabel : styles.moneyLabel}>{label}</Text>
      <Text style={strong ? styles.moneyStrong : styles.moneyValue}>{typeof value === 'number' ? money(value) : value}</Text>
    </View>
  );
}

/** Ítem de una ronda; anulado se ve tachado y no suma (RF-36). */
export function ItemRow({ item, showPrice = true, onVoid }: { item: RoundItem; showPrice?: boolean; onVoid?: () => void }) {
  const v = item.voided;
  return (
    <View style={[styles.item, v && { backgroundColor: colors.redBg }]}>
      <Text style={styles.qty}>{item.qty}×</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, v && styles.struck]}>{item.productName}</Text>
        {item.note ? <Text style={styles.note}>Nota: {item.note}</Text> : null}
        {v && <Text style={styles.voided}>Anulado · {v.by} · {v.reason}</Text>}
      </View>
      {showPrice && <Text style={[styles.itemPrice, v && styles.struck]}>{money(item.qty * item.unitPrice)}</Text>}
      {onVoid && !v && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Anular ${item.productName}`} onPress={onVoid} style={styles.more}>
          <MaterialCommunityIcons name="dots-vertical" size={20} color={colors.ink3} />
        </Pressable>
      )}
    </View>
  );
}

export function Banner({ tone, icon, title, text }: { tone: 'red' | 'amber' | 'green' | 'neutral'; icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; text?: string }) {
  const c = { red: [colors.red, colors.redBg], amber: [colors.amber, colors.amberBg], green: [colors.green, colors.greenBg], neutral: [colors.ink2, colors.face] }[tone];
  return (
    <View style={[styles.banner, { borderColor: c[0], backgroundColor: c[1] }]}>
      <MaterialCommunityIcons name={icon} size={20} color={c[0]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{title}</Text>
        {text ? <Text style={type.small}>{text}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, height: 24, justifyContent: 'center' },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: colors.face, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.face2, borderBottomWidth: 1, borderBottomColor: colors.line },
  cardTitle: { ...type.label, color: colors.ink2, flexShrink: 1 },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', backgroundColor: colors.face },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink, borderBottomWidth: 3, borderBottomColor: colors.trim },
  chipText: { color: colors.ink2, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  chipTextOn: { color: colors.onLight },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  moneyLabel: { color: colors.ink2, fontSize: 15 },
  moneyValue: { color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  moneyStrongLabel: { ...type.label, color: colors.ink, fontSize: 14, alignSelf: 'center' },
  moneyStrong: { ...type.figure, fontSize: 24 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line2 },
  qty: { color: colors.ink, fontWeight: '800', minWidth: 26, fontSize: 15 },
  itemName: { color: colors.ink, fontSize: 15 },
  itemPrice: { color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  note: { color: colors.amber, fontSize: 13, marginTop: 2 },
  voided: { color: colors.red, fontSize: 12, marginTop: 2 },
  struck: { textDecorationLine: 'line-through', color: colors.red },
  more: { minWidth: 44, minHeight: 44, marginVertical: -11, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  bannerTitle: { color: colors.ink, fontWeight: '700', fontSize: 14, marginBottom: 2 },
});
