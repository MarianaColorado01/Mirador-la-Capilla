import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategorySchema, fieldErrors, type Category } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Field, Tag } from '@/components/ui';
import { keys, useCategories, useConnection } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space } from '@/theme';

/** RF-15: el dueño crea, renombra y desactiva categorías. Nunca se borran (RN-04). */
export default function Categorias() {
  const categories = useCategories();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const list = categories.data ?? [];

  return (
    <Screen refreshing={categories.isRefetching} onRefresh={() => categories.refetch()}>
      {editing ? (
        <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <AppButton label="Nueva categoría" icon="plus" variant="outline" onPress={() => setEditing('new')} />
      )}
      {categories.isPending ? (
        <StateView kind="loading" />
      ) : categories.isError && !categories.data ? (
        <StateView kind="error" message={categories.error.message} onRetry={() => categories.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="shape-outline" title="No hay categorías" action={{ label: 'Crear categoría', onPress: () => setEditing('new') }} />
      ) : (
        <Card title={`${list.filter((c) => c.active).length} activas`}>
          {list.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => setEditing(c)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${c.name}${c.active ? '' : ', inactiva'}`}
            >
              <Text style={[styles.name, !c.active && { color: colors.ink3 }]}>{c.name}</Text>
              {!c.active && <Tag label="Inactiva" color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [name, setName] = useState(category?.name ?? '');
  const save = useMutation({
    mutationFn: (body: { name?: string; active?: boolean }) => (category ? api.updateCategory(category.id, body) : api.createCategory(body.name!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.products }); // el nombre de la categoría sale en cada producto
      onDone();
    },
  });

  const parsed = CategorySchema.safeParse({ name });
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field === 'name') errors.name = serverErr.message;

  return (
    <Card title={category ? `Editar · ${category.name}` : 'Nueva categoría'}>
      <View style={styles.body}>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); save.reset(); }} error={name === '' && !category ? undefined : errors.name} maxLength={30} autoCapitalize="sentences" />
        {serverErr && serverErr.field !== 'name' && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
        <AppButton
          label={offline ? 'Sin conexión' : category ? 'Guardar nombre' : 'Crear categoría'}
          icon="content-save-outline"
          loading={save.isPending}
          disabled={!parsed.success || offline || name.trim() === category?.name}
          onPress={() => parsed.success && save.mutate(parsed.data)}
        />
        {category && (
          <AppButton
            label={category.active ? 'Desactivar' : 'Reactivar'}
            icon={category.active ? 'eye-off-outline' : 'eye-outline'}
            variant={category.active ? 'danger' : 'outline'}
            disabled={offline || save.isPending}
            onPress={() => save.mutate({ active: !category.active })}
          />
        )}
        <AppButton label="Cancelar" variant="text" onPress={onDone} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 56, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' },
  body: { padding: space.lg, gap: space.lg },
});
