import { mealTimestamp } from '../utils/latestMeal';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from '../hooks/useTranslation';

// The wedge is a time scale, not a nutrition or hunger recommendation.
export default function MealElapsedIndicator({ meal, now, colors, onPress }) {
  const t = useTranslation();
  const timestamp = mealTimestamp(meal);
  const minutes = timestamp === null ? null : Math.max(0, Math.floor((now - timestamp) / 60000));
  const hours = minutes == null ? null : Math.floor(minutes / 60);
  const elapsed = minutes == null ? '—' : `${hours}:${String(minutes % 60).padStart(2, '0')}`;
  const progress = minutes == null ? 0 : Math.min(1, minutes / 360);
  const x = 48 * progress;
  const y = 26 * (1 - progress);
  return <>
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${t.sinceLastMeal}: ${elapsed}`}
      style={{ position: 'absolute', left: 0, top: 0, width: 82 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.muted, fontSize: 10, lineHeight: 13 }}>{t.sinceLastMeal}</Text>
      <Text key={elapsed} numberOfLines={1} style={{ width: 82, color: colors.text, fontSize: 18, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'], transform: [{ translateY: 4 }] }}>{elapsed}</Text>
      <View style={{ position: 'absolute', left: 0, top: 43, width: 40, height: 1, backgroundColor: colors.border }} />
    </Pressable>
    <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, width: 52, alignItems: 'center' }}>
      <Svg width={50} height={28} viewBox="-1 -1 50 28">
        <Path d="M 0 26 L 48 0 L 48 26 Z" fill={colors.elemBg} />
        {progress > 0 && <Path d={`M 0 26 L ${x} ${y} L ${x} 26 Z`} fill={colors.accent} />}
        <Path d="M 0 26 L 48 0 L 48 26 Z" fill="none" stroke={colors.border} strokeWidth={1} strokeLinejoin="round" />
      </Svg>
      <Text style={{ color: colors.muted, fontSize: 9, lineHeight: 11 }}>0–6 h</Text>
      <View style={{ position: 'absolute', right: 0, top: 43, width: 40, height: 1, backgroundColor: colors.border }} />
    </View>
  </>;
}
