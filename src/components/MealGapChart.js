import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import ChoiceBox from './ChoiceBox';
import { useSettings } from '../state/SettingsContext';
import { summarizeMealGaps } from '../utils/mealGaps';

const labels = {
  sk: ['Prestávky medzi jedlami', 'Priemerná prestávka', 'Viac ako', 'Menej ako', 'Žiadne prestávky v zvolenom rozsahu', 'prestávok'],
  cs: ['Přestávky mezi jídly', 'Průměrná přestávka', 'Více než', 'Méně než', 'Žádné přestávky ve zvoleném rozsahu', 'přestávek'],
  en: ['Time between meals', 'Average interval', 'More than', 'Less than', 'No intervals within the selected limits', 'intervals'],
  de: ['Pausen zwischen Mahlzeiten', 'Durchschnittliche Pause', 'Mehr als', 'Weniger als', 'Keine Pausen innerhalb der gewählten Grenzen', 'Pausen'],
  es: ['Intervalos entre comidas', 'Intervalo medio', 'Más de', 'Menos de', 'No hay intervalos dentro de los límites elegidos', 'intervalos'],
  fr: ['Intervalles entre les repas', 'Intervalle moyen', 'Plus de', 'Moins de', 'Aucun intervalle dans les limites choisies', 'intervalles'],
  it: ['Intervalli tra i pasti', 'Intervallo medio', 'Più di', 'Meno di', 'Nessun intervallo nei limiti selezionati', 'intervalli'],
  pl: ['Przerwy między posiłkami', 'Średnia przerwa', 'Więcej niż', 'Mniej niż', 'Brak przerw w wybranym zakresie', 'przerw'],
};
const duration = hours => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

export default function MealGapChart({ meals, period, viewMode }) {
  const { colors, language, mealGapLimits, setMealGapLimits } = useSettings();
  const t = labels[language] || labels.en;
  const [width, setWidth] = useState(280);
  const [selectedKey, setSelectedKey] = useState(null);
  const monthly = viewMode === 'year';
  const data = useMemo(() => summarizeMealGaps(meals, period.dates, mealGapLimits.min, mealGapLimits.max, monthly), [meals, period, mealGapLimits, monthly]);
  const count = data.reduce((sum, day) => sum + day.count, 0);
  const total = data.reduce((sum, day) => sum + day.total, 0);
  const selected = data.find(day => day.key === selectedKey);
  const left = 44, right = 8, top = 12, height = 140;
  const plotWidth = Math.max(1, width - left - right);
  const slot = plotWidth / Math.max(1, data.length);
  const formatDate = date => date.toLocaleDateString(language, monthly ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'numeric' });
  const options = Array.from({ length: 25 }, (_, value) => ({ value, label: `${value} h` }));
  const minimumOptions = [options[0], { value: 0.5, label: '30 min' }, { value: 0.75, label: '45 min' }, ...options.slice(1)];
  return <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 }}>
    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{t[0]}</Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>{t[1]} · {count ? duration(total / count) : '—'} · {count} {t[5]}</Text>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Svg width="100%" height={height + 40} viewBox={`0 0 ${width} ${height + 40}`}>
        <G x={left} y={top}>
          {[0, .25, .5, .75, 1].map(fraction => <G key={fraction}>
            <Line x1={0} x2={plotWidth} y1={height * (1 - fraction)} y2={height * (1 - fraction)} stroke={colors.border} />
            <SvgText x={-12} y={height * (1 - fraction) + 4} fontSize={10} fill={colors.muted} textAnchor="end">{`${Number((mealGapLimits.max * fraction).toFixed(1)).toLocaleString(language)} h`}</SvgText>
          </G>)}
          {data.map((day, index) => <G key={day.key}>
            {selected?.key === day.key && <Rect x={index * slot} y={-4} width={slot} height={height + 26} rx={3} fill={colors.accent} fillOpacity={.12} stroke={colors.accent} />}
            {day.average !== null && <Rect x={index * slot + slot * .18} y={height - day.average / mealGapLimits.max * height} width={Math.max(1, slot * .64)} height={day.average / mealGapLimits.max * height} rx={2} fill={colors.macros.protein} />}
            {index % (monthly ? 1 : viewMode === 'week' ? 1 : viewMode === 'fortnight' ? 2 : 5) === 0 && <SvgText x={(index + .5) * slot} y={height + 18} fill={colors.muted} fontSize={9} textAnchor="middle">{day.date.toLocaleDateString(language, monthly ? { month: 'narrow' } : viewMode === 'week' ? { weekday: 'narrow' } : { day: 'numeric' })}</SvgText>}
          </G>)}
        </G>
      </Svg>
      <View style={{ position: 'absolute', left, right, top: 0, bottom: 0, flexDirection: 'row' }}>
        {data.map(day => <Pressable key={day.key} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${formatDate(day.date)}, ${day.average === null ? '—' : duration(day.average)}`} onPress={() => setSelectedKey(day.key)} />)}
      </View>
    </View>
    {selected && <Text style={{ color: colors.text, fontSize: 12, textAlign: 'center' }}>{formatDate(selected.date)} · {selected.average === null ? '—' : duration(selected.average)} · {selected.count} {t[5]}</Text>}
    {!count && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{t[4]}</Text>}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, gap: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{t[2]}</Text><ChoiceBox colors={colors} label={t[2]} value={mealGapLimits.min} options={minimumOptions.filter(option => option.value < mealGapLimits.max)} onChange={min => setMealGapLimits(previous => ({ ...previous, min }))} /></View>
      <View style={{ flex: 1, gap: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{t[3]}</Text><ChoiceBox colors={colors} label={t[3]} value={mealGapLimits.max} options={options.filter(option => option.value > mealGapLimits.min)} onChange={max => setMealGapLimits(previous => ({ ...previous, max }))} /></View>
    </View>
  </View>;
}
