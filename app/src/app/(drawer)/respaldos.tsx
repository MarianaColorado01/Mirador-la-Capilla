import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BackupInfo, BackupKind } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Tag } from '@/components/ui';
import { keys, useBackups, useConnection } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { dateTime } from '@/utils/format';
import { colors, radius, space, type } from '@/theme';

const KIND: Record<BackupKind, { label: string; color: string }> = {
  auto: { label: 'Diaria', color: colors.ink2 },
  manual: { label: 'Manual', color: colors.green },
  seguridad: { label: 'Antes de restaurar', color: colors.amber },
};

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** RF-71: copias de la base del PC de caja. El dueño hace una copia, la exporta o la restaura. */
export default function Respaldos() {
  const backups = useBackups();
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [restoring, setRestoring] = useState<BackupInfo | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const create = useMutation<BackupInfo, ApiError>({
    mutationFn: api.createBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.backups }),
  });
  const list = backups.data ?? [];

  const exportBackup = async (id: string) => {
    setExporting(id);
    setExportError(null);
    try {
      if (!(await isAvailableAsync())) return setExportError('Este celular no permite compartir archivos.');
      const uri = await api.downloadBackup(id);
      await shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: `Copia ${id}` });
    } catch {
      setExportError('No se pudo descargar o compartir la copia. Intenta de nuevo.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen refreshing={backups.isRefetching} onRefresh={() => backups.refetch()}>
      <Banner tone="neutral" icon="information-outline" title="El PC de caja guarda una copia cada día" text="Se conservan las últimas 14 diarias. Las manuales y las de antes de restaurar no se borran." />
      <AppButton
        label={offline ? 'Sin conexión' : 'Hacer copia ahora'}
        icon="content-save-outline"
        loading={create.isPending}
        disabled={offline}
        onPress={() => create.mutate()}
      />
      {create.error && <Banner tone="red" icon="alert-circle-outline" title={create.error.message} />}
      {create.isSuccess && <Banner tone="green" icon="check-circle-outline" title="Copia guardada en el PC de caja" />}
      {exportError && <Banner tone="red" icon="alert-circle-outline" title={exportError} />}
      {backups.isPending ? (
        <StateView kind="loading" />
      ) : backups.isError && !backups.data ? (
        <StateView kind="error" message={backups.error.message} onRetry={() => backups.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="database-outline" title="Aún no hay copias" message="La primera copia diaria se hace al encender el servidor." />
      ) : (
        <Card title={`${list.length} copias`}>
          {list.map((b) => (
            <View key={b.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.date}>{dateTime(b.createdAt)}</Text>
                <View style={styles.meta}>
                  <Tag label={KIND[b.kind].label} color={KIND[b.kind].color} />
                  <Text style={type.small}>{size(b.size)}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <AppButton compact label="Exportar" icon="share-variant-outline" variant="outline" loading={exporting === b.id} disabled={offline || exporting !== null} onPress={() => exportBackup(b.id)} />
                <AppButton compact label="Restaurar" icon="backup-restore" variant="danger" disabled={offline} onPress={() => setRestoring(b)} />
              </View>
            </View>
          ))}
        </Card>
      )}
      {restoring && <RestoreSheet backup={restoring} onClose={() => setRestoring(null)} />}
    </Screen>
  );
}

/** Confirmación fuerte: reemplaza TODOS los datos; pide escribir RESTAURAR. */
function RestoreSheet({ backup, onClose }: { backup: BackupInfo; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [word, setWord] = useState('');
  const mut = useMutation<unknown, ApiError>({
    mutationFn: () => api.restoreBackup(backup.id),
    onSuccess: () => {
      qc.invalidateQueries(); // todo cambió; el evento datos:restaurados avisa a los demás celulares
      onClose();
    },
  });
  const ok = word.trim() === 'RESTAURAR';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
        <Text style={type.h}>Restaurar copia del {dateTime(backup.createdAt)}</Text>
        <Banner
          tone="red"
          icon="alert-outline"
          title="Se reemplazan TODOS los datos actuales"
          text="Mesas, ventas, facturas, inventario, usuarios y ajustes vuelven a como estaban en esa fecha. Lo que se hizo después se pierde de la base."
        />
        <Text style={type.small}>Antes de restaurar, el PC de caja guarda una copia de seguridad del estado actual (aparece como «Antes de restaurar»).</Text>
        <View style={{ gap: 4 }}>
          <Text style={type.small}>Escribe RESTAURAR para confirmar</Text>
          <TextInput
            value={word}
            onChangeText={(t) => { setWord(t); mut.reset(); }}
            placeholder="RESTAURAR"
            placeholderTextColor={colors.ink3}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Escribe RESTAURAR para confirmar"
          />
        </View>
        {mut.error && <Banner tone="red" icon="alert-circle-outline" title={mut.error.message} />}
        <AppButton
          label={offline ? 'Sin conexión' : 'Restaurar esta copia'}
          icon="backup-restore"
          variant="danger"
          loading={mut.isPending}
          disabled={!ok || offline}
          onPress={() => mut.mutate()}
        />
        <AppButton label="Cancelar" variant="text" disabled={mut.isPending} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: 14, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.line2 },
  info: { gap: 4 },
  date: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.face, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, gap: space.md },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
});
