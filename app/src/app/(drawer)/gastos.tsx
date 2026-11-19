import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExpenseInput, fieldErrors } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Field } from '@/components/Field';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Card, Chips } from '@/components/ui';
import { useConnection, useExpenses, useInvalidateStock } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';
import { isoDate, money, periodRange, shortDate, type Period } from '@/utils/format';

/** RF-57: gastos adicionales (hielo, gas, servicios) que se restan de la utilidad estimada. */
function Gastos() {
  const conn = useConnection();
  const invalidate = useInvalidateStock();
  const [period, setPeriod] = useState<Period>('hoy');
  const list = useExpenses(periodRange(period));
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(isoDate());
  const [touched, setTouched] = useState(false);

  const parsed = ExpenseInput.safeParse({ concept, amount, date });
  const local = parsed.success ? {} : fieldErrors(parsed.error);
  const save = useMutation({
    mutationFn: () => api.createExpense(parsed.data!),
    onSuccess: () => { setConcept(''); setAmount(''); setTouched(false); invalidate(); },
  });
  const server = save.error instanceof ApiError ? { [save.error.field ?? '_']: save.error.message } : {};
  const err = (k: string) => (touched ? (server as Record<string, string>)[k] ?? local[k] : undefined);
  const total = (list.data ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <Card title="Registrar gasto">
        <View style={{ padding: space.md, gap: space.md }}>
          <Field label="Concepto" value={concept} onChangeText={setConcept} placeholder="Ej. Hielo para el turno" error={err('concept')} maxLength={80} />
          <View style={styles.two}>
            <Field flex={1} label="Monto" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={err('amount')} />
            <Field flex={1} label="Fecha" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={err('date')} />
          </View>
          {err('_') && <Text style={{ color: colors.red }}>{err('_')}</Text>}
          <AppButton label="Registrar gasto" icon="plus" disabled={conn === 'off'} loading={save.isPending} onPress={() => { setTouched(true); if (parsed.success) save.mutate(); }} />
        </View>
      </Card>

      <Chips<Period> value={period} onChange={setPeriod} options={[{ value: 'hoy', label: 'Hoy' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
      <Card>
        <View style={{ padding: space.lg }}>
          <Text style={type.label}>Otros gastos · {period}</Text>
          <Text style={type.figure}>{money(total)}</Text>
          <Text style={type.small}>Se restan de la utilidad estimada en el Resumen.</Text>
        </View>
      </Card>
      {list.isPending ? (
        <StateView kind="loading" />
      ) : list.isError ? (
        <StateView kind="error" message={(list.error as Error).message} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <StateView kind="empty" icon="wallet-outline" title="Sin gastos en este periodo" />
      ) : (
        <Card>
          {list.data.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.date}>{shortDate(e.date)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{e.concept}</Text>
                <Text style={type.small}>{e.user}</Text>
              </View>
              <Text style={styles.amount}>{money(e.amount)}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function GastosScreen() {
  return <RoleGate roles={['dueno']}><Gastos /></RoleGate>;
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 58, borderTopWidth: 1, borderTopColor: colors.line2 },
  date: { color: colors.ink, fontWeight: '700', minWidth: 44 },
  amount: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
