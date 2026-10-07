import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { calculateRestingProfile } from '../utils/calorieExpenditure';

export default function ExpenditureSettings({ colors }) {
  const t = useTranslation();
  const { expenditureEstimateEnabled, setExpenditureEstimateEnabled, manualRestingCalories, setManualRestingCalories,
    restingCaloriesBaseline, restingCaloriesSource, activeCaloriesAvailable, activeCalories, estimatedBurnedCalories, garminModeEnabled, setGarminModeEnabled, garminRestingCalories, setGarminRestingCalories } = useSettings();
  const garminMode = ['android', 'ios'].includes(Platform.OS) && garminModeEnabled;
  const editableResting = garminMode ? garminRestingCalories : manualRestingCalories;
  const [draft, setDraft] = useState(editableResting === null ? '' : String(editableResting));
  const [error, setError] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => { setDraft(editableResting === null ? '' : String(editableResting)); setError(false); }, [editableResting, garminMode]);
  const saveManual = () => {
    const value = draft.trim() === '' ? null : Number(draft.trim().replace(',', '.'));
    if ((garminMode && value === null) || (value !== null && (!Number.isFinite(value) || value < 0 || value > 10000))) { setError(true); return; }
    setError(false);
    if (garminMode) setGarminRestingCalories(value);
    else setManualRestingCalories(value);
  };
  const sources = { manual: t.restingSourceManual, health: t.restingSourceHealth, saved: t.restingSourceSaved, zero: t.restingSourceZero, garmin: t.garminEstimateHint };
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.text }]}>{t.caloriesEstimatedLabel}</Text>
    <Text style={[styles.hint, { color: colors.muted }]}>{garminMode ? t.garminEstimateHint : t.expenditureEstimateHint}</Text>
    {['android', 'ios'].includes(Platform.OS) && <View style={styles.row}>
      <Text style={[styles.label, { flex: 1, color: colors.text }]}>{t.garminModeTitle}</Text>
      <Switch accessibilityLabel={t.garminModeTitle} value={garminModeEnabled} onValueChange={setGarminModeEnabled}
        trackColor={{ true: colors.accent, false: colors.border }} />
    </View>}
    <Button colors={colors} filled onPress={() => setExpenditureEstimateEnabled(!expenditureEstimateEnabled)}
      selected={expenditureEstimateEnabled} label={expenditureEstimateEnabled ? t.expenditureDisable : t.expenditureEnable} />
    <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>{t.restingCalories}: {Math.round(restingCaloriesBaseline).toLocaleString()} kcal</Text>
    <Text style={[styles.hint, { color: colors.muted }]}>{sources[restingCaloriesSource]}</Text>
    <Text style={[styles.label, { color: colors.macros.protein }]}>{t.caloriesEstimatedLabel}: {estimatedBurnedCalories.toLocaleString()} kcal</Text>
    <Text style={[styles.label, { color: colors.text }]}>{garminMode ? t.garminActiveLabel : t.activeCaloriesLabel}: {activeCaloriesAvailable ? `${Math.round(activeCalories).toLocaleString()} kcal` : '—'}</Text>
    {!activeCaloriesAvailable && <Text style={[styles.hint, { color: colors.muted }]}>{t.expenditureNoActive}</Text>}
    <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>{garminMode ? t.garminRestingLabel : t.restingManual}</Text>
    <View style={styles.row}>
      <TextInput accessibilityLabel={garminMode ? t.garminRestingLabel : t.restingManual} value={draft} onChangeText={value => { setDraft(value); setError(false); }}
        keyboardType="decimal-pad" maxLength={8} selectTextOnFocus placeholder={garminMode ? 'kcal' : t.restingAutomatic}
        placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.elemBg, borderColor: colors.elemBorder }]} />
      <Text style={{ color: colors.muted }}>kcal</Text>
      <Button colors={colors} onPress={saveManual} label={t.save} />
    </View>
    {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t.restingInvalid}</Text>}
    {!garminMode && <View style={[styles.row, { marginTop: 10 }]}>
      <Button colors={colors} style={{ flex: 1 }} onPress={() => { setManualRestingCalories(null); setDraft(''); setError(false); }} label={t.restingAutomatic} />
      <Button colors={colors} style={{ flex: 1 }} onPress={() => setProfileOpen(true)} label={t.restingCalculate} />
    </View>}
    {profileOpen && <RestingProfileDialog colors={colors} onClose={() => setProfileOpen(false)} />}
  </View>;
}

function Button({ colors, label, onPress, style, filled = false, selected }) {
  return <Pressable accessibilityRole="button" accessibilityState={selected === undefined ? undefined : { selected }} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: filled ? colors.accent : colors.elemBg, borderColor: colors.elemBorder, opacity: pressed ? 0.7 : 1 }, style]}>
    <Text style={{ color: filled ? colors.onAccent : colors.text, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}

export function RestingProfileDialog({ colors, onClose }) {
  const t = useTranslation();
  const { restingEnergyProfile, setRestingEnergyProfile, setManualRestingCalories } = useSettings();
  const [draft, setDraft] = useState({ age: String(restingEnergyProfile?.age ?? ''), height: String(restingEnergyProfile?.height ?? ''),
    weight: String(restingEnergyProfile?.weight ?? ''), sex: restingEnergyProfile?.sex || 'male', activity: restingEnergyProfile?.activity || 'sedentary' });
  const [error, setError] = useState(false);
  const profile = { ...draft, age: Number(draft.age), height: Number(draft.height.replace(',', '.')), weight: Number(draft.weight.replace(',', '.')) };
  const estimate = calculateRestingProfile(profile);
  const update = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setError(false); };
  const choices = (key, items) => <View style={[styles.row, { alignItems: 'stretch' }]}>{items.map(([value, label]) =>
    <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: draft[key] === value }} onPress={() => update(key, value)}
      style={[styles.choice, { backgroundColor: draft[key] === value ? colors.accent : colors.elemBg, borderColor: colors.elemBorder }]}>
      <Text style={{ fontWeight: '600', textAlign: 'center', color: draft[key] === value ? colors.onAccent : colors.text }}>{label}</Text>
    </Pressable>
  )}</View>;
  const save = () => {
    if (!estimate) { setError(true); return; }
    setRestingEnergyProfile(profile);
    setManualRestingCalories(estimate.resting);
    onClose();
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.dialog, { backgroundColor: colors.modalBg }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t.restingCalculate}</Text>
          {[[ 'age', t.profileAge ], [ 'height', t.profileHeight ], [ 'weight', t.profileWeight ]].map(([key, label]) =>
            <View key={key} style={styles.row}>
              <Text style={[styles.label, { flex: 1, color: colors.text }]}>{label}</Text>
              <TextInput accessibilityLabel={label} value={draft[key]} onChangeText={value => update(key, value)}
                keyboardType={key === 'age' ? 'number-pad' : 'decimal-pad'} maxLength={6} selectTextOnFocus
                style={[styles.input, { width: 110, color: colors.text, borderColor: colors.elemBorder, backgroundColor: colors.elemBg }]} />
            </View>
          )}
          <Text style={[styles.label, { color: colors.text }]}>{t.profileSex}</Text>
          {choices('sex', [['male', t.profileMale], ['female', t.profileFemale]])}
          <Text style={[styles.label, { color: colors.text }]}>{t.profileActivity}</Text>
          {choices('activity', [['sedentary', t.profileSedentary], ['moderate', t.profileModerate], ['athlete', t.profileAthlete]])}
          <Text style={[styles.hint, { color: colors.muted }]}>{t.profileActivityHint}</Text>
          {estimate && <View style={[styles.result, { backgroundColor: colors.elemBg }]}>
            <Text style={[styles.label, { color: colors.macros.protein }]}>{t.restingCalories}: {estimate.resting.toLocaleString()} kcal</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>{t.profileTotal}: {estimate.total.toLocaleString()} kcal</Text>
          </View>}
          {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t.profileInvalid}</Text>}
          <View style={styles.row}>
            <Button colors={colors} style={{ flex: 1 }} onPress={onClose} label={t.cancel} />
            <Button colors={colors} style={{ flex: 1 }} filled onPress={save} label={t.save} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 46, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, fontSize: 16 },
  button: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  choice: { flex: 1, minHeight: 56, padding: 8, borderWidth: 1, borderRadius: 10, justifyContent: 'center' },
  backdrop: { flex: 1, padding: 20, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 20, alignSelf: 'center', overflow: 'hidden' },
  result: { padding: 12, borderRadius: 12 },
});
