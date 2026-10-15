import ChoiceBox from './ChoiceBox';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';

export default function AdditionalBurnedCaloriesSettings({ colors }) {
  const { additionalBurnedCalories, additionalCountsAsActive, setAdditionalBurnedCalories, currentDay } = useSettings();
  const t = useTranslation();
  const [input, setInput] = useState(String(additionalBurnedCalories));
  const [target, setTarget] = useState(additionalCountsAsActive ? 'active' : 'total');
  useEffect(() => { setInput(String(additionalBurnedCalories)); setTarget(additionalCountsAsActive ? 'active' : 'total'); }, [additionalBurnedCalories, additionalCountsAsActive, currentDay]);
  const save = () => {
    const calories = input.trim() === '' ? 0 : Number(input.replace(',', '.'));
    if (!Number.isFinite(calories) || calories < 0) {
      Alert.alert(t.additionalBurnedTitle, t.additionalBurnedInvalid);
      return;
    }
    setAdditionalBurnedCalories(calories, target === 'active');
    setInput(String(Math.round(calories)));
  };
  return <View style={{ marginTop: 16, gap: 10 }}>
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t.additionalBurnedTitle}</Text>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{t.additionalBurnedHint}</Text>
    <ChoiceBox colors={colors} label={t.additionalBurnedTarget} value={target} onChange={setTarget}
      options={[{ value: 'total', label: t.additionalBurnedTotalOnly }, { value: 'active', label: t.additionalBurnedAlsoActive }]} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TextInput value={input} onChangeText={setInput} keyboardType="numeric" inputMode="numeric"
        accessibilityLabel={t.additionalBurnedTitle} selectTextOnFocus onSubmitEditing={save}
        style={{ flex: 1, minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: colors.elemBorder, color: colors.text, backgroundColor: colors.elemBg }} />
      <Text style={{ color: colors.muted }}>kcal</Text>
      <Pressable accessibilityRole="button" onPress={save} style={{ minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent }}>
        <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t.save || 'Save'}</Text>
      </Pressable>
    </View>
  </View>;
}
