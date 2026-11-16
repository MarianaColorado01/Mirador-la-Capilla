import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { fieldErrors, SettingsSchema, type Settings } from '@mirador/shared';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Banner, Card, Field } from '@/components/ui';
import { keys, useConnection, useSettings } from '@/hooks/queries';
import { api, ApiError } from '@/services/api';
import { colors, space, type } from '@/theme';

type NumKey = Exclude<keyof Settings, 'businessName' | 'singleOperator'>;
const NUMS: NumKey[] = ['taxPercent', 'suggestedTipPercent', 'maxPinAttempts', 'lockMinutes', 'idleLogoutMinutes', 'barLat', 'barLng'];
type Form = { businessName: string; singleOperator: boolean } & Record<NumKey, string>;

const toForm = (s: Settings): Form => ({ businessName: s.businessName, singleOperator: s.singleOperator, ...Object.fromEntries(NUMS.map((k) => [k, String(s[k])])) }) as Form;
// Vacío no es 0: el esquema lo marca como «Escribe un número». Se acepta coma decimal.
const toNumber = (t: string) => (t.trim() === '' ? NaN : Number(t.trim().replace(',', '.')));

/** RF-04: ajustes del negocio (solo el dueño). */
export default function Ajustes() {
  const settings = useSettings();
  if (settings.isPending) return <Screen><StateView kind="loading" /></Screen>;
  if (settings.isError) return <Screen><StateView kind="error" message={settings.error.message} onRetry={() => settings.refetch()} /></Screen>;
  return <SettingsForm initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient();
  const offline = useConnection() === 'off';
  const [saved, setSaved] = useState(() => toForm(initial));
  const [form, setForm] = useState(saved);
  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: keys.settings });
      setSaved(toForm(s));
      setForm(toForm(s));
      Alert.alert('Ajustes guardados');
    },
  });

  const values = { ...form, ...Object.fromEntries(NUMS.map((k) => [k, toNumber(form[k])])) };
  const parsed = SettingsSchema.safeParse(values);
  const errors = fieldErrors(parsed.error);
  const serverErr = save.error instanceof ApiError ? save.error : null;
  if (serverErr?.field && !errors[serverErr.field]) errors[serverErr.field] = serverErr.message;
  const changed = JSON.stringify(form) !== JSON.stringify(saved);

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    save.reset();
  };
  const num = (k: NumKey, label: string, help?: string) => (
    <Field half={!help} label={label} value={form[k]} onChangeText={set(k)} error={errors[k]} help={help} keyboardType={k === 'barLng' || k === 'barLat' ? 'numbers-and-punctuation' : 'numeric'} />
  );

  return (
    <Screen
      footer={
        <AppButton
          label={offline ? 'Sin conexión' : 'Guardar ajustes'}
          icon="content-save-outline"
          loading={save.isPending}
          disabled={!changed || !parsed.success || offline}
          onPress={() => parsed.success && save.mutate(parsed.data)}
        />
      }
    >
      {serverErr && !serverErr.field && <Banner tone="red" icon="alert-circle-outline" title={serverErr.message} />}
      <Card title="Negocio">
        <View style={styles.body}>
          <Field label="Nombre del negocio" value={form.businessName} onChangeText={set('businessName')} error={errors.businessName} maxLength={60} />
          <View style={styles.row}>
            {num('taxPercent', 'Impuesto (%)')}
            {num('suggestedTipPercent', 'Propina sugerida (%)')}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>Modo un solo operador</Text>
              <Text style={type.small}>El perfil «Todo en uno» toma, prepara y cobra sin pasos de barra.</Text>
            </View>
            <Switch
              value={form.singleOperator}
              onValueChange={set('singleOperator')}
              trackColor={{ true: colors.trim, false: colors.line }}
              accessibilityLabel="Modo un solo operador"
            />
          </View>
        </View>
      </Card>
      <Card title="Seguridad">
        <View style={styles.body}>
          <View style={styles.row}>
            {num('maxPinAttempts', 'Intentos de PIN')}
            {num('lockMinutes', 'Bloqueo (min)')}
          </View>
          {num('idleLogoutMinutes', 'Cerrar sesión sin uso (min)', 'Cada celular vuelve a pedir el PIN tras este tiempo sin tocar la pantalla.')}
        </View>
      </Card>
      <Card title="Ubicación del bar">
        <View style={styles.body}>
          <View style={styles.row}>
            {num('barLat', 'Latitud')}
            {num('barLng', 'Longitud')}
          </View>
          <Text style={type.small}>Punto del bar en el mapa de ubicación.</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
