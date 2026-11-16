import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role, RoundItem, RoundStatus } from '@mirador/shared';
import { colors, radius, space, type } from '@/theme';
import { AppButton } from './AppButton';
import { QuantityCounter } from './QuantityCounter';
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
  /** RF-33: en una ronda tomada también se cambia cantidad o nota. Tope = stock libre + lo ya pedido. */
  maxQty?: number;
  onSave?: (qty: number, note: string | null) => void;
  /** Error del servidor al guardar; si trae `field` se muestra bajo ese campo. */
  saveError?: { message: string; field?: string } | null;
}

/** Hoja para editar (RF-33) o anular un ítem con motivo obligatorio (RF-33 a RF-35, tabla 4.2). */
export function VoidItemSheet({ item, roundStatus, role, busy, offline, onClose, onConfirm, maxQty, onSave, saveError }: Props) {
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<number | null>(null);
  const [other, setOther] = useState('');
  const [restock, setRestock] = useState(true);
  // Quien la usa le pone key = id del ítem, así el estado arranca con sus valores.
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [note, setNote] = useState(item?.note ?? '');

  const taken = roundStatus === 'tomado';
  const delivered = roundStatus === 'entregado';
  const allowed = taken ? role !== 'barra' : delivered ? role === 'dueno' : ['caja', 'todo', 'dueno'].includes(role);
  const canEdit = taken && allowed && !!onSave && !!item;
  const changed = !!item && (qty !== item.qty || (note.trim() || null) !== item.note);
  const errFor = (f: string) => (saveError?.field === f ? <Text style={styles.error}>{saveError.message}</Text> : null);
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
      <ScrollView style={styles.sheetBox} contentContainerStyle={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.grab} />
        <Text style={type.h}>
          {canEdit ? 'Cambiar o quitar' : taken ? 'Quitar' : 'Anular'} {item?.qty} × {item?.productName}
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
            {canEdit && item && (
              <>
                <Text style={type.label}>Cambiar cantidad o nota</Text>
                <View style={styles.qtyRow}>
                  {/* Bajar de 1 no quita el ítem: para eso se elige un motivo abajo (RN-04). */}
                  <QuantityCounter value={qty} max={Math.max(maxQty ?? item.qty, item.qty)} onChange={setQty} onBelowMin={() => {}} />
                  <Text style={type.small}>{(maxQty ?? item.qty) > item.qty ? `Máximo ${maxQty} por stock` : 'No queda más stock'}</Text>
                </View>
                {errFor('qty')}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota para barra, ej. sin hielo"
                  placeholderTextColor={colors.ink3}
                  maxLength={100}
                  style={styles.input}
                  accessibilityLabel="Nota del ítem"
                />
                <Text style={[type.small, { textAlign: 'right' }]}>{note.length}/100</Text>
                {errFor('note')}
                {saveError && saveError.field !== 'qty' && saveError.field !== 'note' && <Banner tone="red" icon="alert-circle-outline" title={saveError.message} />}
                <AppButton
                  label={offline ? 'Sin conexión' : 'Guardar cambios'}
                  icon="content-save-outline"
                  variant="outline"
                  loading={busy}
                  disabled={!changed || offline}
                  onPress={() => onSave!(qty, note.trim() || null)}
                />
                <Text style={[type.label, { marginTop: space.sm }]}>O quitar el ítem</Text>
              </>
            )}
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
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetBox: { flexGrow: 0, maxHeight: '90%', backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: colors.red, fontSize: 13 },
  sheet: { backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, gap: space.md },
  grab: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.ink3, opacity: 0.6 },
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 48, borderTopWidth: 1, borderTopColor: colors.line2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink3 },
  radioOn: { borderColor: colors.trim, backgroundColor: colors.trim },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
