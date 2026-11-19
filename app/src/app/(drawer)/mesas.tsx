import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fieldErrors, TableCreateSchema, TableUpdateSchema, type TableAdmin } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Field, Tag } from '@/components/ui';
import { keys, useConnection, useTablesAdmin } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';
import { pad } from '@/utils/format';

/** RF-22: el dueño crea mesas con número único, cambia su zona y las desactiva (si no tienen cuenta abierta). */
export default function Mesas() {
  const tables = useTablesAdmin();
  const [editing, setEditing] = useState<TableAdmin | 'new' | null>(null);
  const list = tables.data ?? [];

  return (
    <Screen refreshing={tables.isRefetching} onRefresh={() => tables.refetch()}>
      {editing ? (
        <TableForm key={editing === 'new' ? 'new' : editing.id} table={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <AppButton label="Nueva mesa" icon="plus" variant="outline" onPress={() => setEditing('new')} />
      )}
      {tables.isPending ? (
        <StateView kind="loading" />
      ) : tables.isError && !tables.data ? (
        <StateView kind="error" message={tables.error.message} onRetry={() => tables.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="table-furniture" title="No hay mesas" action={{ label: 'Crear mesa', onPress: () => setEditing('new') }} />
      ) : (
        <Card title={`${list.filter((t) => t.active).length} activas`}>
          {list.map((t) => (
            <Pressable
              key={t.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => setEditing(t)}
              accessibilityRole="button"
              accessibilityLabel={`Editar mesa ${t.number}${t.zone ? `, ${t.zone}` : ''}${t.active ? '' : ', inactiva'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !t.active && { color: colors.ink3 }]}>Mesa {pad(t.number)}</Text>
                <Text style={type.small}>{t.zone ?? 'Sin zona'}</Text>
              </View>
              {t.busy && <Tag label="Con cuenta" color={colors.ocupada} />}
              {!t.active && <Tag label="Inactiva" color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function TableForm({ table, onDone }: { table: TableAdmin | null; onDone: () => void }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [number, setNumber] = useState('');
  const [zone, setZone] = useState(table?.zone ?? '');
  const save = useMutation({
    mutationFn: (body: { number?: number; zone?: string | null; active?: boolean }) =>
      table ? api.updateTable(table.id, body) : api.createTable(body as { number: number }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tables }); // también el mapa de mesas
      onDone();
    },
  });

  const parsed = table ? TableUpdateSchema.safeParse({ zone }) : TableCreateSchema.safeParse({ number: number === '' ? NaN : Number(number), zone });
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && serverErr.field !== 'active') errors[serverErr.field] = serverErr.message;
  const edit = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); save.reset(); };

  return (
    <Card title={table ? `Editar · Mesa ${pad(table.number)}` : 'Nueva mesa'}>
      <View style={styles.body}>
        {!table && (
          <Field label="Número" value={number} onChangeText={(t) => edit(setNumber)(t.replace(/\D/g, ''))} error={number === '' ? undefined : errors.number} keyboardType="number-pad" maxLength={3} />
        )}
        <Field label="Zona (opcional)" value={zone} onChangeText={edit(setZone)} error={errors.zone} help="Ej. Terraza o Salón." maxLength={30} autoCapitalize="sentences" />
        {serverErr && (!serverErr.field || serverErr.field === 'active') && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
        <AppButton
          label={offline ? 'Sin conexión' : table ? 'Guardar zona' : 'Crear mesa'}
          icon="content-save-outline"
          loading={save.isPending}
          disabled={!parsed.success || offline}
          onPress={() => parsed.success && save.mutate(parsed.data)}
        />
        {table && (
          <AppButton
            label={table.active ? 'Desactivar' : 'Reactivar'}
            icon={table.active ? 'eye-off-outline' : 'eye-outline'}
            variant={table.active ? 'danger' : 'outline'}
            disabled={offline || save.isPending}
            onPress={() => save.mutate({ active: !table.active })}
          />
        )}
        {table?.busy && table.active && <Text style={type.small}>Tiene una cuenta sin cerrar: no se puede desactivar hasta cobrarla o moverla.</Text>}
        <AppButton label="Cancelar" variant="text" onPress={onDone} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  body: { padding: space.lg, gap: space.lg },
});
