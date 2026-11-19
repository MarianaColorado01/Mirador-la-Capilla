/* Piezas pequeñas compartidas: etiquetas de estado, tarjetas, chips, filas de dinero y ítems. */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import type { RoundItem, RoundStatus } from '@mirador/shared';
import { colors, tabular, text } from '@/theme';
import { money } from '@/utils/format';

export const ROUND_LABEL: Record<RoundStatus, string> = { tomado: 'Tomada', preparacion: 'Preparando', listo: 'Lista', entregado: 'Entregada' };
const ROUND_COLOR: Record<RoundStatus, string> = { tomado: colors.ink, preparacion: colors.amber, listo: colors.green, entregado: colors.ink3 };

export function Tag({ label, color = colors.ink2 }: { label: string; color?: string }) {
  return (
    <View className="border-[1.5px] rounded-full px-[9px] h-[24px] justify-center" style={{ borderColor: color }}>
      <Text className="font-display text-[11px] tracking-[1px] uppercase" style={{ color }}>{label}</Text>
    </View>
  );
}

export const RoundTag = ({ status }: { status: RoundStatus }) => <Tag label={ROUND_LABEL[status]} color={ROUND_COLOR[status]} />;

export function Card({ children, title, right, style }: { children: ReactNode; title?: string; right?: ReactNode; style?: ViewStyle }) {
  return (
    <View className="bg-face rounded-md border border-line overflow-hidden" style={style}>
      {(title || right) && (
        <View className="flex-row items-center justify-between gap-sm px-[14px] py-[10px] bg-face2 border-b border-b-line">
          {title ? <Text className="font-display text-[12px] tracking-[1.4px] uppercase text-ink2 shrink">{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm py-[2px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            className={`min-h-[40px] px-[14px] rounded-md border justify-center ${on ? 'bg-ink border-ink border-b-[3px] border-b-trim' : 'bg-face border-line'}`}
          >
            <Text className={`font-display text-[13px] tracking-[0.8px] uppercase ${on ? 'text-onLight' : 'text-ink2'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MoneyRow({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between py-sm border-b border-b-line2">
      <Text className={strong ? 'font-display text-[14px] tracking-[1.4px] uppercase text-ink self-center' : 'font-body text-[15px] text-ink2'}>{label}</Text>
      <Text className={strong ? 'font-display text-[24px] text-ink' : 'font-body text-[15px] text-ink'} style={tabular}>
        {typeof value === 'number' ? money(value) : value}
      </Text>
    </View>
  );
}

/** Ítem de una ronda; anulado se ve tachado y no suma (RF-36). */
export function ItemRow({ item, showPrice = true, onVoid }: { item: RoundItem; showPrice?: boolean; onVoid?: () => void }) {
  const v = item.voided;
  const line = `font-body text-[15px] ${v ? 'text-red line-through' : 'text-ink'}`;
  return (
    <View className={`flex-row items-start gap-[10px] px-[14px] py-[11px] border-t border-t-line2 ${v ? 'bg-redBg' : ''}`}>
      <Text className="font-display text-[15px] text-ink min-w-[26px]">{item.qty}×</Text>
      <View className="flex-1">
        <Text className={line}>{item.productName}</Text>
        {item.note ? <Text className="font-body text-[13px] text-amber mt-[2px]">Nota: {item.note}</Text> : null}
        {v && <Text className="font-body text-[12px] text-red mt-[2px]">Anulado · {v.by} · {v.reason}</Text>}
      </View>
      {showPrice && <Text className={line} style={tabular}>{money(item.qty * item.unitPrice)}</Text>}
      {onVoid && !v && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Anular ${item.productName}`}
          onPress={onVoid}
          className="min-w-[44px] min-h-[44px] -my-[11px] -mr-[12px] items-center justify-center"
        >
          <MaterialCommunityIcons name="dots-vertical" size={20} color={colors.ink3} />
        </Pressable>
      )}
    </View>
  );
}

/** Campo de formulario con etiqueta y error debajo (o ayuda). `half` para dos campos en una fila. */
export function Field({ label, error, help, half, ...input }: TextInputProps & { label: string; error?: string; help?: string; half?: boolean }) {
  return (
    <View className={`gap-[6px] ${half ? 'flex-1' : ''}`}>
      <Text className="font-body-semi text-[13px] text-ink2">{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink3}
        accessibilityLabel={label}
        {...input}
        className={`min-h-[50px] rounded-md px-md bg-face font-body text-[17px] text-ink ${error ? 'border-2 border-red' : 'border border-line'}`}
      />
      {error ? <Text className="font-body text-[13px] text-red">{error}</Text> : help ? <Text className={text.small}>{help}</Text> : null}
    </View>
  );
}

export function Banner({ tone, icon, title, text }: { tone: 'red' | 'amber' | 'green' | 'neutral'; icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; text?: string }) {
  const c = { red: [colors.red, colors.redBg], amber: [colors.amber, colors.amberBg], green: [colors.green, colors.greenBg], neutral: [colors.ink2, colors.face] }[tone];
  return (
    <View className="flex-row gap-[10px] border rounded-md p-md" style={{ borderColor: c[0], backgroundColor: c[1] }}>
      <MaterialCommunityIcons name={icon} size={20} color={c[0]} />
      <View className="flex-1">
        <Text className="font-body-bold text-[14px] text-ink mb-[2px]">{title}</Text>
        {text ? <Text className="font-body text-[13px] text-ink3">{text}</Text> : null}
      </View>
    </View>
  );
}
