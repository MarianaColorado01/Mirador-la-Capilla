import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Tag } from '@/components/ui';
import { useInvoices } from '@/hooks/queries';
import { colors, radius, type } from '@/theme';
import { dateTime, money, pad } from '@/utils/format';

const METHOD: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

/** RF-43: historial de facturas con búsqueda por número o fecha (AAAA-MM-DD). */
function Facturas() {
  const [q, setQ] = useState('');
  const query = q.trim();
  const invoices = useInvoices(/^\d+$/.test(query) || /^\d{4}-\d{2}-\d{2}$/.test(query) ? query : '');
  const typedPartial = query && !/^\d+$/.test(query) && !/^\d{4}-\d{2}-\d{2}$/.test(query);

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Número (128) o fecha (2026-11-09)" placeholderTextColor={colors.ink3} keyboardType="numbers-and-punctuation" style={styles.input} />
      </View>
      {typedPartial && <Text style={type.small}>Escribe un número de factura o una fecha completa AAAA-MM-DD.</Text>}
      {invoices.isPending ? (
        <StateView kind="loading" />
      ) : invoices.isError ? (
        <StateView kind="error" message={(invoices.error as Error).message} onRetry={() => invoices.refetch()} />
      ) : invoices.data.length === 0 ? (
        <StateView kind="empty" icon="receipt" title={query ? `No hay facturas para «${query}»` : 'Aún no hay facturas'} />
      ) : (
        <Card>
          {invoices.data.map((v) => (
            <Pressable key={v.id} style={({ pressed }) => [styles.row, v.voided && { backgroundColor: colors.redBg }, pressed && { opacity: 0.8 }]} onPress={() => router.push({ pathname: '/factura/[id]', params: { id: String(v.id) } })} accessibilityRole="button">
              <Text style={styles.num}>{pad(v.number, 6)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.small}>{dateTime(v.createdAt)}</Text>
                <Text style={type.small}>Mesa {pad(v.tableNumber)} · {METHOD[v.method] ?? v.method}</Text>
              </View>
              {v.voided && <Tag label="Anulada" color={colors.red} />}
              <Text style={[styles.total, v.voided && { textDecorationLine: 'line-through', color: colors.red }]}>{money(v.total)}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function FacturasScreen() {
  return <RoleGate roles={['todo', 'caja', 'dueno']}><Facturas /></RoleGate>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.face },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.line2 },
  num: { color: colors.ink, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  total: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
