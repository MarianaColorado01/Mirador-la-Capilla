import { StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { colors, radius, type } from '@/theme';

export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  help?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  flex?: number;
}

/** Campo de formulario con su mensaje de error debajo (validaciones por campo). */
export function Field({ label, value, onChangeText, error, help, placeholder, keyboardType, multiline, maxLength, flex }: FieldProps) {
  return (
    <View style={{ gap: 6, flex }}>
      <Text style={styles.lb}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.multi, !!error && styles.err]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.errText}>{error}</Text> : help ? <Text style={type.small}>{help}</Text> : null}
    </View>
  );
}

export function SwitchRow({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{label}</Text>
        {help ? <Text style={type.small}>{help}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.trim, false: colors.line }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lb: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.face },
  multi: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  err: { borderColor: colors.red, borderWidth: 2 },
  errText: { color: colors.red, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
});
