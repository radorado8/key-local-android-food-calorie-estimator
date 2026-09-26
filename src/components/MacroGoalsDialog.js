import { typography } from '../theme/palette';
import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, ScrollView, View, Text, TextInput, Pressable, Switch, StyleSheet } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { MACRO_KEYS, resolveMacroGoals, validMacroGoals } from '../utils/macroGoals';

export default function MacroGoalsDialog({ colors, onClose }) {
  const t = useTranslation();
  const { dailyGoal, macroGoals, customMacroGoals, setCustomMacroGoals } = useSettings();
  const [automatic, setAutomatic] = useState(!customMacroGoals);
  const [draft, setDraft] = useState(Object.fromEntries(MACRO_KEYS.map(key => [key, String(macroGoals[key])])));
  const [error, setError] = useState(false);
  const defaults = resolveMacroGoals(dailyGoal);
  const save = () => {
    const parsed = Object.fromEntries(MACRO_KEYS.map(key => [key, Number(draft[key].trim().replace(',', '.'))]));
    if (!automatic && !validMacroGoals(parsed)) { setError(true); return; }
    setCustomMacroGoals(automatic ? null : parsed);
    onClose();
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.card, { backgroundColor: colors.modalBg }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{t.macroGoalsTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{`${dailyGoal.toLocaleString()} kcal`}</Text>
          <View style={styles.row}>
            <Text style={[styles.autoLabel, { color: colors.text }]}>{t.macroGoalsAuto}</Text>
            <Switch value={automatic} onValueChange={value => { setAutomatic(value); setError(false); }} accessibilityLabel={t.macroGoalsAuto} trackColor={{ true: colors.accent }} />
          </View>
          {MACRO_KEYS.map(key => <View key={key} style={[styles.nutrient, { backgroundColor: colors.elemBg }]}>
            <View style={[styles.dot, { backgroundColor: colors.macros[key] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>{t[key]}</Text>
              {automatic && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{`${{ protein: 20, carbs: 50, fat: 30 }[key]} %`}</Text>}
            </View>
            <TextInput accessibilityLabel={`${t[key]} (g)`} value={automatic ? String(defaults[key]) : draft[key]}
              editable={!automatic} keyboardType="decimal-pad" maxLength={7} selectTextOnFocus
              onChangeText={value => { setDraft(current => ({ ...current, [key]: value })); setError(false); }}
              style={[styles.input, { color: colors.text, borderColor: automatic ? 'transparent' : colors.border }]} />
            <Text style={{ color: colors.muted }}>g</Text>
          </View>)}
          {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t.macroGoalsInvalid}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.button, { borderColor: colors.border, borderWidth: 1 }]}><Text style={[styles.buttonLabel, { color: colors.text }]}>{t.cancel}</Text></Pressable>
            <Pressable onPress={save} style={[styles.button, { backgroundColor: colors.accent }]}><Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{t.save}</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { borderRadius: 18, maxHeight: '90%', width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  content: { padding: 22, gap: 12 },
  title: { ...typography.sectionTitle,  },
  subtitle: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  autoLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  nutrient: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderRadius: 14 },
  dot: { width: 9, height: 28, borderRadius: 5 },
  label: { ...typography.sectionTitle,  },
  input: { width: 78, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, textAlign: 'right', fontSize: 20, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
});
