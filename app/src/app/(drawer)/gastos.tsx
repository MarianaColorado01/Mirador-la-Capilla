import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExpenseSchema, fieldErrors, localDate, periodRange, type Period } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Chips, Field } from '@/components/ui';
import { keys, useConnection, useExpenses } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';
import { money, PERIOD_OPTIONS, PERIOD_TEXT } from '@/utils/format';

/**
 * RF-57: gastos adicionales (hielo, gas, servicios) del dueño. Se restan de la utilidad en el Resumen.
 * No se editan ni se borran (RN-04).
 */
export default function Gastos() {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [period, setPeriod] = useState<Period>('hoy');
  const range = periodRange(period);
  const expenses = useExpenses(range);
  const list = expenses.data ?? [];

  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  // Un campo vacío no se marca en rojo hasta que lo toquen.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: api.createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: keys.reports });
      setConcept('');
      setAmount('');
      setTouched({});
    },
  });
  const serverErr = save.error instanceof ApiError ? save.error : null;
  const parsed = ExpenseSchema.safeParse({ concept, amount: amount === '' ? NaN : Number(amount), date });
  const errors = fieldErrors(parsed.error);
  if (serverErr?.field) errors[serverErr.field] ??= serverErr.message;
  const shown = (k: string) => (touched[k] || serverErr?.field === k ? errors[k] : undefined);
  const edit = (k: string, set: (v: string) => void) => (t: string) => { set(t); setTouched((x) => ({ ...x, [k]: true })); save.reset(); };

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={() => expenses.refetch()}>
      <Card title="Registrar gasto">
        <View style={styles.body}>
          {serverErr && !serverErr.field && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
          <Field label="Concepto" value={concept} onChangeText={edit('concept', setConcept)} error={shown('concept')} placeholder="Hielo, gas, servicios…" maxLength={60} />
          <View style={styles.row}>
            <Field half label="Monto" value={amount} onChangeText={edit('amount', (t) => setAmount(t.replace(/\D/g, '')))} error={shown('amount')} keyboardType="number-pad" placeholder="0" />
            <Field half label="Fecha" value={date} onChangeText={edit('date', (t) => setDate(t.trim()))} error={shown('date')} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="AAAA-MM-DD" />
          </View>
          <AppButton
            label={offline ? 'Sin conexión' : 'Registrar gasto'}
            icon="plus"
            loading={save.isPending}
            disabled={!parsed.success || offline}
            onPress={() => parsed.success && save.mutate(parsed.data)}
          />
        </View>
      </Card>

      <Chips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      {expenses.isPending ? (
        <StateView kind="loading" />
      ) : expenses.isError && !expenses.data ? (
        <StateView kind="error" message={expenses.error.message} onRetry={() => expenses.refetch()} />
      ) : list.length === 0 ? (
        <StateView kind="empty" icon="cash-minus" title={`Sin gastos ${PERIOD_TEXT[period]}`} message="Los que registres arriba aparecen aquí." />
      ) : (
        <Card title={`Otros gastos · ${PERIOD_TEXT[period]}`} right={<Text style={styles.sum}>{money(list.reduce((t, e) => t + e.amount, 0))}</Text>}>
          {list.map((e) => (
            <View key={e.id} style={styles.item} accessible accessibilityLabel={`${e.concept}, ${money(e.amount)}, ${e.date}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.concept}</Text>
                <Text style={type.small}>{e.date} · {e.user}</Text>
              </View>
              <Text style={styles.sum}>{money(e.amount)}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 56, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sum: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
