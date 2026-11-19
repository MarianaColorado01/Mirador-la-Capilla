import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Category } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field } from '@/components/Field';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card } from '@/components/ui';
import { useCategories, useInvalidateStock } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, radius, space, type } from '@/theme';

function Row({ c }: { c: Category }) {
  const invalidate = useInvalidateStock();
  const [editing, setEditing] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name?: string; active?: boolean }) => api.updateCategory(c.id, body),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError: (e) => Alert.alert('No se pudo guardar', (e as Error).message),
  });
  return (
    <View style={styles.row}>
      {editing != null ? (
        <TextInput value={editing} onChangeText={setEditing} autoFocus style={styles.input} onSubmitEditing={() => save.mutate({ name: editing })} />
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={[type.body, !c.active && { color: colors.ink3, textDecorationLine: 'line-through' }]}>{c.name}</Text>
          <Text style={type.small}>{c.products} {c.products === 1 ? 'producto activo' : 'productos activos'}</Text>
        </View>
      )}
      {editing != null ? (
        <Pressable onPress={() => save.mutate({ name: editing })} accessibilityLabel="Guardar nombre" hitSlop={8}>
          <MaterialCommunityIcons name="check" size={24} color={colors.green} />
        </Pressable>
      ) : (
        <Pressable onPress={() => setEditing(c.name)} accessibilityLabel={`Renombrar ${c.name}`} hitSlop={8}>
          <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.ink2} />
        </Pressable>
      )}
      <Switch value={c.active} onValueChange={(v) => save.mutate({ active: v })} trackColor={{ true: colors.trim, false: colors.line }} accessibilityLabel={`${c.name} activa`} />
    </View>
  );
}

/** RF-15: crear, renombrar y desactivar categorías. */
function Categorias() {
  const cats = useCategories();
  const invalidate = useInvalidateStock();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.createCategory({ name, active: true }),
    onSuccess: () => { setName(''); invalidate(); },
  });
  const err = create.error instanceof ApiError ? create.error.message : undefined;

  return (
    <Screen>
      <View style={styles.newRow}>
        <Field flex={1} label="Nueva categoría" value={name} onChangeText={(t) => { setName(t); create.reset(); }} placeholder="Ej. Vinos" error={err} maxLength={30} />
        <View style={{ paddingTop: 22 }}>
          <AppButton label="Crear" icon="plus" compact disabled={name.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
        </View>
      </View>
      {cats.isPending ? (
        <StateView kind="loading" />
      ) : cats.isError ? (
        <StateView kind="error" message={(cats.error as Error).message} onRetry={() => cats.refetch()} />
      ) : (
        <Card title="Categorías">{cats.data.map((c) => <Row key={c.id} c={c} />)}</Card>
      )}
      <Text style={type.small}>Desactivar una categoría no borra sus productos; solo deja de ofrecerse al crear o editar productos.</Text>
    </Screen>
  );
}

export default function CategoriasScreen() {
  return <RoleGate roles={['dueno']}><Categorias /></RoleGate>;
}

const styles = StyleSheet.create({
  newRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, minHeight: 60, borderTopWidth: 1, borderTopColor: colors.line2 },
  input: { flex: 1, minHeight: 44, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, paddingHorizontal: 10, color: colors.ink, fontSize: 16 },
});
