import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../state/SettingsContext';
import { COLOR_THEMES, getPalette, typography } from '../theme/palette';

const labels = {
  sk: ['Farebný motív', 'Mäta', 'Oceán', 'Slivka', 'Originál'],
  cs: ['Barevný motiv', 'Máta', 'Oceán', 'Švestka', 'Originál'],
  en: ['Color palette', 'Mint', 'Ocean', 'Plum', 'Original'],
  de: ['Farbpalette', 'Minze', 'Ozean', 'Pflaume', 'Original'],
  es: ['Paleta de colores', 'Menta', 'Océano', 'Ciruela', 'Original'],
  fr: ['Palette de couleurs', 'Menthe', 'Océan', 'Prune', 'Original'],
  it: ['Palette di colori', 'Menta', 'Oceano', 'Prugna', 'Originale'],
  pl: ['Paleta kolorów', 'Mięta', 'Ocean', 'Śliwka', 'Oryginalny'],
};
export default function ColorThemePicker() {
  const { colors, colorTheme, setColorTheme, theme, language } = useSettings();
  const text = labels[language] || labels.en;
  return (
    <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 12 }}>
      <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: 14 }]}>{text[0]}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {COLOR_THEMES.map((id, index) => {
          const sample = getPalette(theme, id);
          const selected = id === colorTheme;
          return (
            <Pressable key={id} accessibilityRole="radio" accessibilityLabel={text[index + 1]} accessibilityState={{ checked: selected }}
              onPress={() => setColorTheme(id)}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minWidth: 120, minHeight: 96, padding: 10, borderRadius: 14, borderWidth: 2,
                borderColor: selected ? colors.accent : colors.border, backgroundColor: sample.bg, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: sample.accent }} />
                {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
              </View>
              <Text style={{ color: sample.text, fontSize: 13, fontWeight: '600' }}>{text[index + 1]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
