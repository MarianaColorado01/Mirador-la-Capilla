import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { ProductCard } from '@/components/ProductCard';
import { QuantityCounter } from '@/components/QuantityCounter';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips, Tag } from '@/components/ui';
import { useAccount, useConnection, useInvalidateFloor, useProducts, useSettings } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { useRoundDrafts, type Draft } from '@/store/round-drafts';
import { useSession } from '@/store/session';
import { colors, radius, space, type } from '@/theme';
import { money, pad } from '@/utils/format';

const EMPTY: Draft['items'] = [];

/** RF-23 a RF-28: armar la ronda por categoría o búsqueda y confirmarla. */
export default function TomarRonda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const role = useSession((s) => s.user!.role);
  const account = useAccount(accountId);
  const products = useProducts();
  const conn = useConnection();
  const invalidate = useInvalidateFloor();

  const draft = useRoundDrafts((s) => s.drafts[String(accountId)]);
  const items = draft?.items ?? EMPTY;
  const { add, setQty, setNote, remove, discard, renewKey } = useRoundDrafts();
  const settings = useSettings();
  const singleOperator = role === 'todo' && !!settings.data?.singleOperator;

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const [notesOpen, setNotesOpen] = useState<Record<number, boolean>>({});

  const categories = useMemo(() => ['Todas', ...new Set((products.data ?? []).map((p) => p.categoryName))], [products.data]);
  const shown = (products.data ?? []).filter(
    (p) => (cat === 'Todas' || p.categoryName === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const units = items.reduce((s, i) => s + i.qty, 0);

  const confirm = useMutation({
    mutationFn: () =>
      api.createRound(accountId, { items: items.map((i) => ({ productId: i.productId, qty: i.qty, note: i.note.trim() || null })) }, draft!.key),
    onSuccess: (acc) => {
      discard(accountId);
      invalidate(accountId);
      const last = acc.rounds[acc.rounds.length - 1];
      Alert.alert(
        `Ronda ${last.number} confirmada`,
        last.status === 'entregado' ? 'Quedó registrada como entregada.' : 'Ya aparece en la pantalla de barra.',
      );
      router.back();
    },
    onError: (e) => {
      invalidate(accountId);
      // La ronda anterior llegó aunque la respuesta se perdió: clave nueva para lo que falte enviar.
      if (e instanceof ApiError && e.field === 'Idempotency-Key') {
        renewKey(accountId);
        Alert.alert('Revisa antes de reenviar', e.message);
        return;
      }
      // El borrador se conserva: el mesero corrige y vuelve a confirmar.
      Alert.alert('No se envió la ronda', (e as Error).message);
    },
  });

  const askRemove = (productId: number, name: string) =>
    Alert.alert(`¿Quitar ${name}?`, 'Sale de esta ronda. Puedes volver a agregarlo desde el catálogo.', [
      { text: 'Mantener', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => remove(accountId, productId) },
    ]);

  const a = account.data;
  const blocked = a && a.status !== 'abierta';

  return (
    <Screen
      footer={
        <>
          <View style={styles.totalRow}>
            <Text style={type.label}>Total ronda · {units} {units === 1 ? 'unidad' : 'unidades'}</Text>
            <Text style={[type.figure, { fontSize: 24 }]}>{money(total)}</Text>
          </View>
          <AppButton
            label={conn === 'off' ? 'Confirmar · sin conexión' : singleOperator ? 'Confirmar y entregar' : 'Confirmar y enviar a barra'}
            icon="check"
            disabled={!items.length || conn === 'off' || !!blocked}
            loading={confirm.isPending}
            onPress={() => confirm.mutate()}
          />
        </>
      }
    >
      <Stack.Screen options={{ title: a ? `Ronda ${a.rounds.length + 1} · Mesa ${pad(a.tableNumber)}` : 'Ronda' }} />
      {blocked && <StateView kind="empty" icon="lock-outline" title="La cuenta no admite rondas" message="Está por cobrar o pagada. Caja puede reabrirla." />}
      {a && a.subtotal > 0 && (
        <Card>
          <View style={styles.prev}>
            <MaterialCommunityIcons name="receipt" size={20} color={colors.ink3} />
            <Text style={[type.small, { flex: 1 }]}>
              Ya en la cuenta: {a.rounds.length} {a.rounds.length === 1 ? 'ronda' : 'rondas'} · <Text style={{ color: colors.ink, fontWeight: '700' }}>{money(a.subtotal)}</Text>
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre…" placeholderTextColor={colors.ink3} style={styles.searchInput} />
        {!!q && (
          <Pressable onPress={() => setQ('')} accessibilityLabel="Borrar búsqueda" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={20} color={colors.ink3} />
          </Pressable>
        )}
      </View>
      <Chips value={cat} onChange={setCat} options={categories.map((c) => ({ value: c, label: c }))} />

      <Card>
        {products.isPending ? (
          <StateView kind="loading" message="Cargando catálogo…" />
        ) : products.isError && !products.data ? (
          <StateView kind="error" message={(products.error as Error).message} onRetry={() => products.refetch()} />
        ) : shown.length === 0 ? (
          <StateView
            kind="empty"
            icon="magnify"
            title={q ? `Nada coincide con «${q}»` : 'No hay productos en esta categoría'}
            message={cat !== 'Todas' ? `Prueba otra palabra o quita el filtro ${cat}.` : 'Prueba con otra palabra.'}
            action={{ label: 'Quitar filtros', onPress: () => { setQ(''); setCat('Todas'); } }}
          />
        ) : (
          shown.map((p) => (
            <View key={p.id} style={styles.divider}>
              <ProductCard product={p} inRound={items.find((i) => i.productId === p.id)?.qty ?? 0} onAdd={(prod) => add(accountId, prod)} onOpen={(prod) => router.push(`/producto/${prod.id}`)} />
            </View>
          ))
        )}
      </Card>

      <Card title={`Esta ronda · ${units} ${units === 1 ? 'unidad' : 'unidades'}`} right={items.length ? <Tag label="Borrador guardado" /> : undefined}>
        {items.length === 0 ? (
          <Text style={[type.small, { padding: space.lg }]}>Toca + en un producto para agregarlo. Mantén pulsado para ver su detalle.</Text>
        ) : (
          items.map((i) => (
            <View key={i.productId} style={styles.line}>
              <View style={styles.lineTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '600' }]}>{i.name}</Text>
                  <Text style={type.small}>
                    {money(i.price)} c/u · subtotal {money(i.price * i.qty)}
                    {i.qty >= i.stock ? ` · máx. ${i.stock}` : ''}
                  </Text>
                </View>
                <QuantityCounter value={i.qty} max={i.stock} onChange={(n) => setQty(accountId, i.productId, n)} onBelowMin={() => askRemove(i.productId, i.name)} />
              </View>
              {notesOpen[i.productId] || i.note ? (
                <View style={{ gap: 4 }}>
                  <TextInput
                    value={i.note}
                    onChangeText={(t) => setNote(accountId, i.productId, t)}
                    placeholder="Nota para barra, ej. sin hielo"
                    placeholderTextColor={colors.ink3}
                    maxLength={100}
                    style={styles.note}
                  />
                  <Text style={[type.small, { textAlign: 'right' }]}>{i.note.length}/100</Text>
                </View>
              ) : (
                <AppButton label="Agregar nota" icon="note-edit-outline" variant="text" compact onPress={() => setNotesOpen((s) => ({ ...s, [i.productId]: true }))} />
              )}
            </View>
          ))
        )}
      </Card>
      {items.length > 0 && (
        <AppButton
          label="Descartar borrador"
          variant="text"
          compact
          onPress={() =>
            Alert.alert('¿Descartar la ronda?', 'Se borran los productos que llevas agregados.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Descartar', style: 'destructive', onPress: () => discard(accountId) },
            ])
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prev: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line2 },
  line: { padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line2 },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  note: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 15 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
