import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';

export default function LatestMealBar({ meal, colors, onPress }) {
  const t = useTranslation();
  const [failedUri, setFailedUri] = useState(null);
  if (!meal) return null;
  const value = key => Math.round(Number(meal[key]) || 0);
  return (
    <Pressable accessibilityRole="button" accessibilityHint={t.latestMealOpenHistory}
      onPress={onPress} style={({ pressed }) => [styles.bar, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      {meal.imageUri && meal.imageUri !== failedUri
        ? <Image source={{ uri: meal.imageUri }} style={styles.photo} resizeMode="cover" onError={() => setFailedUri(meal.imageUri)} />
        : <View style={[styles.photo, styles.placeholder, { backgroundColor: colors.elemBg }]}><Ionicons name="restaurant-outline" size={24} color={colors.accent} /></View>}
      <View style={styles.info}>
        <Text style={[styles.label, { color: colors.muted }]}>{t.latestMealTitle}</Text>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{meal.name || t.unknownFood}</Text>
        <View style={styles.nutrients}>
          <Text style={[styles.kcal, { color: colors.calories }]}>{value('calories')} kcal</Text>
          <Text style={[styles.macro, { color: colors.muted }]}>{`${t.macroShortP} ${value('protein')}g · ${t.macroShortC} ${value('carbs')}g · ${t.macroShortF} ${value('fat')}g${meal.weight_g ? ` · ${meal.weight_g}g` : ''}`}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, width: '100%' },
  photo: { width: 54, height: 54, borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 14, fontWeight: '600' },
  name: { fontSize: 15, fontWeight: '600' },
  nutrients: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  kcal: { fontSize: 12, fontWeight: '700' },
  macro: { fontSize: 11 },
});
