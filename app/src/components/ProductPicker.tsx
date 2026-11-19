import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProductOwnerView } from '@mirador/shared';
import { colors, radius, space, type } from '@/theme';
import { money } from '@/utils/format';

interface Props {
  visible: boolean;
  products: ProductOwnerView[];
  onPick: (p: ProductOwnerView) => void;
  onClose: () => void;
}

/** Selector de producto con búsqueda, para compras y ajustes. */
export function ProductPicker({ visible, products, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const shown = products.filter((p) => !q.trim() || `${p.name} ${p.categoryName}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom }]}>
        <View style={styles.head}>
          <Text style={type.title}>Elige un producto</Text>
          <Pressable onPress={onClose} accessibilityLabel="Cerrar" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Buscar…" placeholderTextColor={colors.ink3} style={styles.input} />
        </View>
        <FlatList
          data={shown}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[type.small, { padding: space.lg, textAlign: 'center' }]}>Nada coincide con «{q}».</Text>}
          renderItem={({ item: p }) => (
            <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]} onPress={() => { onPick(p); setQ(''); }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{p.name}{p.active ? '' : ' (inactivo)'}</Text>
                <Text style={type.small}>{p.categoryName} · stock {p.stock} · costo {money(p.cost)}</Text>
              </View>
              <MaterialCommunityIcons name="plus" size={22} color={colors.ink2} />
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line2 },
});
