import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Tag } from '@/components/ui';
import { useInvoices } from '@/hooks/queries';
import { colors, radius, type } from '@/theme';
import { dateTime, money, pad } from '@/utils/format';

const METHOD = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' } as const;
// El servidor busca por número exacto o por día (AAAA-MM-DD).
const VALID = /^(\d+|\d{4}-\d{2}-\d{2})$/;

/** RF-43: historial de facturas con búsqueda por número o fecha. */
export default function Facturas() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const invoices = useInvoices(q);
  const list = invoices.data ?? [];
  const invalid = text.trim() !== '' && !VALID.test(text.trim());

  const search = (t: string) => {
    setText(t);
    if (t.trim() === '' || VALID.test(t.trim())) setQ(t.trim());
  };
  const today = () => {
    const d = new Date();
    search(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      <View style={{ gap: 4 }}>
        <View style={[styles.search, invalid && { borderColor: colors.red }]}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
          <TextInput
            value={text}
            onChangeText={search}
            placeholder="N.º de factura o fecha AAAA-MM-DD"
            placeholderTextColor={colors.ink3}
            style={styles.input}
            autoCapitalize="none"
            accessibilityLabel="Buscar factura por número o fecha"
          />
          {!!text && (
            <Pressable onPress={() => search('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10}>
              <MaterialCommunityIcons name="close" size={20} color={colors.ink3} />
            </Pressable>
          )}
        </View>
        {invalid && <Text style={styles.error}>Escribe solo el número (ej. 128) o una fecha (ej. 2026-11-16).</Text>}
      </View>
      <Pressable style={styles.today} onPress={today} accessibilityRole="button" accessibilityLabel="Ver facturas de hoy">
        <Text style={styles.todayText}>Hoy</Text>
      </Pressable>

      {invoices.isPending ? (
        <StateView kind="loading" />
      ) : invoices.isError && !invoices.data ? (
        <StateView kind="error" message={(invoices.error as Error).message} onRetry={() => invoices.refetch()} />
      ) : list.length === 0 ? (
        <StateView
          kind="empty"
          icon="receipt"
          title={q ? 'Ninguna factura coincide' : 'Aún no hay facturas'}
          message={q ? undefined : 'Cuando caja cobre una cuenta, la factura aparece aquí.'}
          action={q ? { label: 'Ver todas', onPress: () => search('') } : undefined}
        />
      ) : (
        <Card title={q ? `${list.length} resultado${list.length === 1 ? '' : 's'}` : 'Últimas facturas'}>
          {list.map((v) => (
            <Pressable
              key={v.id}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.face2 }]}
              onPress={() => router.push({ pathname: '/factura/[id]', params: { id: String(v.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`Factura ${v.number}${v.voided ? ', anulada' : ''}, ${money(v.total)}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.number, v.voided && styles.struck]}>N.º {pad(v.number, 6)}</Text>
                <Text style={type.small}>
                  Mesa {pad(v.tableNumber)} · {dateTime(v.createdAt)} · {METHOD[v.method]}
                </Text>
              </View>
              {v.voided && <Tag label="Anulada" color={colors.red} />}
              <Text style={[styles.amount, v.voided && styles.struck]}>{money(v.total)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  error: { color: colors.red, fontSize: 13 },
  today: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', backgroundColor: colors.face },
  todayText: { color: colors.ink2, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  number: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  amount: { color: colors.ink, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] },
  struck: { textDecorationLine: 'line-through', color: colors.ink3 },
});
