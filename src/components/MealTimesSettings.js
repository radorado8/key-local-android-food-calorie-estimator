import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { DEFAULT_MEAL_STARTS, MEAL_TYPES, formatMealStart, parseMealStart, validMealStarts } from '../utils/mealTypes';

const drafts = starts => Object.fromEntries(MEAL_TYPES.map(({ id }) => [id, formatMealStart(starts[id])]));

export default function MealTimesSettings({ colors }) {
  const { mealTypeStarts, setMealTypeStarts } = useSettings();
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(false);
  const save = () => {
    const starts = Object.fromEntries(MEAL_TYPES.map(({ id }) => [id, parseMealStart(draft[id])]));
    if (!validMealStarts(starts)) { setError(true); return; }
    setMealTypeStarts(starts);
    setOpen(false);
  };
  return <>
    <Pressable accessibilityRole="button" onPress={() => { setDraft(drafts(mealTypeStarts)); setError(false); setOpen(true); }}
      style={{ padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name="time-outline" size={24} color={colors.accent} />
      <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: 16 }}>{t.mealTimesTitle}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
    {open && <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'center', padding: 24 }}>
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, alignSelf: 'center', maxHeight: '90%', borderRadius: 18, backgroundColor: colors.modalBg, borderWidth: 1, borderColor: colors.border }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{t.mealTimesTitle}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{t.mealTimesHint}</Text>
            {MEAL_TYPES.map((type, index) => <View key={type.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{t[type.labelKey]}</Text>
              <TextInput accessibilityLabel={t[type.labelKey]} value={draft[type.id]} placeholder="HH:mm" maxLength={5}
                autoCorrect={false} selectTextOnFocus keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                onChangeText={value => { setDraft(previous => ({ ...previous, [type.id]: value })); setError(false); }}
                style={{ width: 82, minHeight: 46, textAlign: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.elemBorder, color: colors.text, backgroundColor: colors.elemBg, fontVariant: ['tabular-nums'] }} />
              <Text style={{ width: 58, color: colors.muted, fontSize: 12 }}>– {draft[MEAL_TYPES[(index + 1) % MEAL_TYPES.length].id] || '—'}</Text>
            </View>)}
            {error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{t.mealTimesInvalid}</Text>}
            <Pressable onPress={() => { setDraft(drafts(DEFAULT_MEAL_STARTS)); setError(false); }} style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.accent, textAlign: 'center', fontWeight: '600' }}>{t.mealTimesReset}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setOpen(false)} style={{ flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elemBg }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t.cancel}</Text></Pressable>
              <Pressable onPress={save} style={{ flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t.save}</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </>;
}
