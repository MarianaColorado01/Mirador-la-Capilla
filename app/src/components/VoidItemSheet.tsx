import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role, RoundItem, RoundStatus } from '@mirador/shared';
import { colors, radius, space, type } from '@/theme';
import { AppButton } from './AppButton';
import { Banner, ROUND_LABEL } from './ui';

const REASONS = ['Cliente cambió de opinión', 'Error al tomar el pedido', 'Producto en mal estado'];

interface Props {
  item: RoundItem | null;
  roundStatus: RoundStatus;
  role: Role;
  busy: boolean;
  /** Sin conexión con caja no se confirma nada (RF-67). */
  offline: boolean;
  onClose: () => void;
  onConfirm: (reason: string, restock: boolean) => void;
}

/** Hoja para anular un ítem con motivo obligatorio (RF-33 a RF-35, tabla 4.2). */
export function VoidItemSheet({ item, roundStatus, role, busy, offline, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<number | null>(null);
  const [other, setOther] = useState('');
  const [restock, setRestock] = useState(true);

  const taken = roundStatus === 'tomado';
  const delivered = roundStatus === 'entregado';
  const allowed = taken ? role !== 'barra' : delivered ? role === 'dueno' : ['caja', 'todo', 'dueno'].includes(role);
  const reason = choice === REASONS.length ? other.trim() : choice != null ? REASONS[choice] : '';

  const close = () => {
    setChoice(null);
    setOther('');
    setRestock(true);
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
        <View style={styles.grab} />
        <Text style={type.h}>
          {taken ? 'Quitar' : 'Anular'} {item?.qty} × {item?.productName}
        </Text>
        <Text style={type.small}>Ronda {ROUND_LABEL[roundStatus].toLowerCase()}</Text>
        {!allowed ? (
          <Banner
            tone="amber"
            icon="lock-outline"
            title={delivered ? 'Solo el dueño anula ítems entregados' : 'Solo caja o el dueño anulan ítems en preparación o listos'}
            text={delivered ? 'Si se anula, queda como merma sin devolver stock.' : 'Pídeselo a caja.'}
          />
        ) : (
          <>
            <View style={styles.list}>
              {[...REASONS, 'Otro motivo'].map((r, i) => (
                <Pressable key={r} style={styles.option} onPress={() => setChoice(i)} accessibilityRole="radio" accessibilityState={{ checked: choice === i }}>
                  <View style={[styles.radio, choice === i && styles.radioOn]} />
                  <Text style={type.body}>{r}</Text>
                </Pressable>
              ))}
            </View>
            {choice === REASONS.length && (
              <TextInput value={other} onChangeText={setOther} placeholder="Escribe el motivo" placeholderTextColor={colors.ink3} style={styles.input} maxLength={200} />
            )}
            {!taken && !delivered && (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>Devolver al stock</Text>
                  <Text style={type.small}>Solo si no se alcanzó a preparar.</Text>
                </View>
                <Switch value={restock} onValueChange={setRestock} trackColor={{ true: colors.trim, false: colors.line }} />
              </View>
            )}
            <Text style={type.small}>
              {taken ? 'El stock se devuelve. ' : delivered ? 'No se devuelve stock: queda como merma. ' : ''}Quedará registrado quién, cuándo y por qué.
            </Text>
            <AppButton
              label={offline ? 'Sin conexión' : taken ? 'Quitar ítem' : 'Anular ítem'}
              icon="close-circle-outline"
              variant="danger"
              loading={busy}
              disabled={reason.length < 3 || offline}
              onPress={() => onConfirm(reason, taken || (!delivered && restock))}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, gap: space.md },
  grab: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.ink3, opacity: 0.6 },
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 48, borderTopWidth: 1, borderTopColor: colors.line2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink3 },
  radioOn: { borderColor: colors.trim, backgroundColor: colors.trim },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
