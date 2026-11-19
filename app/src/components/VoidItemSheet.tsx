import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role, RoundItem, RoundStatus } from '@mirador/shared';
import { colors, space, text } from '@/theme';
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
  const errFor = (f: string) => (saveError?.field === f ? <Text className="font-body text-[13px] text-red">{saveError.message}</Text> : null);
  const reason = choice === REASONS.length ? other.trim() : choice != null ? REASONS[choice] : '';

  const close = () => {
    setChoice(null);
    setOther('');
    setRestock(true);
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/60" onPress={close} accessibilityLabel="Cerrar" />
      <ScrollView
        className="grow-0 max-h-[90%] bg-face rounded-t-[18px]"
        contentContainerClassName="p-lg gap-md"
        contentContainerStyle={{ paddingBottom: space.lg + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="self-center w-[38px] h-[4px] rounded-[2px] bg-ink3 opacity-60" />
        <Text className={text.h}>
          {canEdit ? 'Cambiar o quitar' : taken ? 'Quitar' : 'Anular'} {item?.qty} × {item?.productName}
        </Text>
        <Text className={text.small}>Ronda {ROUND_LABEL[roundStatus].toLowerCase()}</Text>
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
                <Text className={text.label}>Cambiar cantidad o nota</Text>
                <View className="flex-row items-center gap-md">
                  {/* Bajar de 1 no quita el ítem: para eso se elige un motivo abajo (RN-04). */}
                  <QuantityCounter value={qty} max={Math.max(maxQty ?? item.qty, item.qty)} onChange={setQty} onBelowMin={() => {}} />
                  <Text className={text.small}>{(maxQty ?? item.qty) > item.qty ? `Máximo ${maxQty} por stock` : 'No queda más stock'}</Text>
                </View>
                {errFor('qty')}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota para barra, ej. sin hielo"
                  placeholderTextColor={colors.ink3}
                  maxLength={100}
                  className="min-h-[48px] border border-line rounded-md px-md font-body text-[16px] text-ink"
                  accessibilityLabel="Nota del ítem"
                />
                <Text className={`${text.small} text-right`}>{note.length}/100</Text>
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
                <Text className={`${text.label} mt-sm`}>O quitar el ítem</Text>
              </>
            )}
            <View className="border border-line rounded-md overflow-hidden">
              {[...REASONS, 'Otro motivo'].map((r, i) => (
                <Pressable key={r} className="flex-row items-center gap-md px-[14px] min-h-[48px] border-t border-t-line2" onPress={() => setChoice(i)} accessibilityRole="radio" accessibilityState={{ checked: choice === i }}>
                  <View className={`w-[20px] h-[20px] rounded-[10px] border-2 ${choice === i ? 'border-trim bg-trim' : 'border-ink3'}`} />
                  <Text className={text.body}>{r}</Text>
                </Pressable>
              ))}
            </View>
            {choice === REASONS.length && (
              <TextInput value={other} onChangeText={setOther} placeholder="Escribe el motivo" placeholderTextColor={colors.ink3} className="min-h-[48px] border border-line rounded-md px-md font-body text-[16px] text-ink" maxLength={200} />
            )}
            {!taken && !delivered && (
              <View className="flex-row items-center gap-md">
                <View className="flex-1">
                  <Text className={text.body}>Devolver al stock</Text>
                  <Text className={text.small}>Solo si no se alcanzó a preparar.</Text>
                </View>
                <Switch value={restock} onValueChange={setRestock} trackColor={{ true: colors.trim, false: colors.line }} />
              </View>
            )}
            <Text className={text.small}>
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
