import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { fieldErrors, ROLES, UserCreateSchema, UserUpdateSchema, type ManagedUser, type Role } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { ROLE_LABEL, Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Field, Tag } from '@/components/ui';
import { keys, useConnection, useUsers } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { useSession } from '@/store/session';
import { colors, space, type } from '@/theme';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

/** RF-07: el dueño crea, edita y desactiva usuarios. Nunca se borran (RN-04). */
export default function Usuarios() {
  const users = useUsers();
  const me = useSession((s) => s.user?.id);
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null);
  const list = users.data ?? [];

  return (
    <Screen refreshing={users.isRefetching} onRefresh={() => users.refetch()}>
      {editing ? (
        <UserForm key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me} onDone={() => setEditing(null)} />
      ) : (
        <AppButton label="Nuevo usuario" icon="account-plus-outline" variant="outline" onPress={() => setEditing('new')} />
      )}
      {users.isPending ? (
        <StateView kind="loading" />
      ) : users.isError && !users.data ? (
        <StateView kind="error" message={users.error.message} onRetry={() => users.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="account-group-outline" title="No hay usuarios" action={{ label: 'Crear usuario', onPress: () => setEditing('new') }} />
      ) : (
        <Card title={`${list.filter((u) => u.active).length} activos`}>
          {list.map((u) => (
            <Pressable
              key={u.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => setEditing(u)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${u.name}, ${ROLE_LABEL[u.role]}${u.active ? '' : ', inactivo'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !u.active && { color: colors.ink3 }]}>{u.name}{u.id === me ? ' (tú)' : ''}</Text>
                <Text style={type.small}>{ROLE_LABEL[u.role]}</Text>
              </View>
              {!u.active && <Tag label="Inactivo" color={colors.ink3} />}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function UserForm({ user, isMe, onDone }: { user: ManagedUser | null; isMe: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'mesero');
  const [pin, setPin] = useState('');

  const save = useMutation({
    mutationFn: (body: Parameters<typeof api.updateUser>[1]) =>
      user ? api.updateUser(user.id, body) : api.createUser(body as Parameters<typeof api.createUser>[0]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.users });
      qc.invalidateQueries({ queryKey: ['profiles'] }); // la lista de perfiles del login
      onDone();
    },
  });

  // Al editar, el PIN vacío significa «no cambiarlo».
  const body = { name, role, ...(user && pin === '' ? {} : { pin }) };
  const parsed = user ? UserUpdateSchema.safeParse(body) : UserCreateSchema.safeParse(body);
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  const showErr = (k: string) => (k === 'pin' && pin === '' ? undefined : errors[k]);
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    save.reset();
  };

  const toggleActive = () => {
    if (!user) return;
    if (!user.active) return save.mutate({ active: true });
    Alert.alert(`¿Desactivar a ${user.name}?`, 'No podrá entrar ni seguir operando. Su historial se conserva y puedes reactivarlo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: () => save.mutate({ active: false }) },
    ]);
  };

  return (
    <Card title={user ? `Editar · ${user.name}` : 'Nuevo usuario'}>
      <View style={styles.body}>
        <Field label="Nombre" value={name} onChangeText={edit(setName)} error={name === '' ? undefined : errors.name} maxLength={30} autoCapitalize="words" />
        <View style={{ gap: 6 }}>
          <Text style={type.label}>Rol</Text>
          <Chips options={ROLE_OPTIONS} value={role} onChange={edit(setRole)} />
          {errors.role && <Text style={styles.err}>{errors.role}</Text>}
        </View>
        <Field
          label={user ? 'PIN nuevo (opcional)' : 'PIN'}
          value={pin}
          onChangeText={(t) => edit(setPin)(t.replace(/\D/g, ''))}
          error={showErr('pin')}
          help={user ? 'Déjalo vacío para no cambiarlo.' : '4 dígitos.'}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
        />
        {serverErr && !serverErr.field && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
        {serverErr?.field === 'active' && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
        <AppButton
          label={offline ? 'Sin conexión' : user ? 'Guardar cambios' : 'Crear usuario'}
          icon="content-save-outline"
          loading={save.isPending}
          disabled={!parsed.success || offline}
          onPress={() => parsed.success && save.mutate(parsed.data)}
        />
        {user && !isMe && (
          <AppButton
            label={user.active ? 'Desactivar' : 'Reactivar'}
            icon={user.active ? 'account-off-outline' : 'account-check-outline'}
            variant={user.active ? 'danger' : 'outline'}
            disabled={offline || save.isPending}
            onPress={toggleActive}
          />
        )}
        <AppButton label="Cancelar" variant="text" onPress={onDone} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  body: { padding: space.lg, gap: space.lg },
  err: { color: colors.red, fontSize: 13 },
});
