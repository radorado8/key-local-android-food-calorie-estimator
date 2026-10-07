import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, G, Path, Text as SvgText } from 'react-native-svg';
import { subscribeToMeals } from '../api/mealService';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../state/SettingsContext';

export default function DailySummary({ dailyGoal = 2100, colors, useLocalStorage = false, onPress, burnedCalories = null, estimatedBurnedCalories = null, expenditureEstimateEnabled = false, healthConnectEnabled = false }) {
  const t = useTranslation();
  const { language, macroGoals, activeCalories } = useSettings();
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);
  const [ringWidth, setRingWidth] = useState(312);
  const ringScale = Math.min(1, ringWidth / 312);

  // Time & Meal Type Logic
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [mealTypeStr, setMealTypeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      // Date: "Pondelok, 6. Jan"
      const dateOpts = { weekday: 'long', day: 'numeric', month: 'short' };
      setDateStr(now.toLocaleDateString(language, dateOpts));

      // Time: "11:45"
      const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
      setTimeStr(now.toLocaleTimeString(language, timeOpts));

      // Meal Type
      const hour = now.getHours();
      let mType = t.catOther;
      if (hour >= 5 && hour < 10) mType = t.catBreakfast;
      else if (hour >= 10 && hour < 11) mType = t.catSnack1;
      else if (hour >= 11 && hour < 14) mType = t.catLunch;
      else if (hour >= 14 && hour < 17) mType = t.catSnack2;
      else if (hour >= 17 && hour < 22) mType = t.catDinner;
      else if (hour >= 22 || hour < 5) mType = t.catSnack3;

      setMealTypeStr(mType);
    };

    updateTime();
    const timer = setInterval(updateTime, 10000); // every 10s is enough
    return () => clearInterval(timer);
  }, [language, t]);

  // ... (useEffect remains same, omitted for brevity if using replace_file_content carefully)

  useEffect(() => {
    // Local mode: always proceed
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const unsub = subscribeToMeals(useLocalStorage, (fetched) => {
      const next = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      const dailyMap = {};

      // Helper to get local date key YYYY-MM-DD
      const getLocalDateKey = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      const todayKey = getLocalDateKey(today);

      // Initialize 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const key = getLocalDateKey(d);
        dailyMap[key] = 0;
      }

      fetched.forEach((data) => {
        const mealDate = data.dateObj || new Date(data.timestamp);
        const mealCals = Number(data.calories) || 0;
        const dateKey = getLocalDateKey(mealDate);

        if (dateKey === todayKey) {
          next.calories += mealCals;
          next.protein += Number(data.protein) || 0;
          next.carbs += Number(data.carbs) || 0;
          next.fat += Number(data.fat) || 0;
        }

        if (dailyMap[dateKey] !== undefined) {
          dailyMap[dateKey] += mealCals;
        }
      });

      // Find first meal date (start of measurement)
      let firstMealEpoch = Infinity;
      if (fetched.length > 0) {
        fetched.forEach(m => {
          const timestamp = m.dateObj ? m.dateObj.getTime() : (m.timestamp ? new Date(m.timestamp).getTime() : Date.now());
          if (timestamp < firstMealEpoch) firstMealEpoch = timestamp;
        });
      } else {
        // If no data, assume user starts "now", so previous days are treated as history
        firstMealEpoch = Date.now();
      }

      // If no meals, treat effectively as if user started 'tomorrow' (so today is 0 real, older are fake)
      // But we must exclude today from fake data logic as per requirement "okrem dneska"
      const firstMealDate = new Date(firstMealEpoch);
      firstMealDate.setHours(0, 0, 0, 0); // Start of that day

      // Apply fake data for pure history gaps before start
      // Requirement: "okrem dneska a zacatia merania" => Fake only if day < firstMealDate AND not Today
      Object.keys(dailyMap).forEach(key => {
        const [y, m, d] = key.split('-').map(Number);
        const currentDayDate = new Date(y, m - 1, d);

        // If older than first meal AND not today
        // Note: isToday check is redundant if firstMealDate <= today, but safe to keep
        if (currentDayDate < firstMealDate && key !== todayKey) {
          const seed = currentDayDate.getDate() * 7 + currentDayDate.getMonth() * 13 + y;
          // Random factor between 0.85 and 1.15
          // (seed % 30) gives 0..29 -> /100 -> 0.00..0.29 -> +0.85 -> 0.85..1.14
          const randomFactor = 0.85 + ((seed % 30) / 100);
          dailyMap[key] = Math.round(dailyGoal * randomFactor);
        }
      });

      // Format for Chart
      const weekStats = Object.keys(dailyMap).sort().map(key => {
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return {
          label: date.toLocaleDateString(language, { weekday: 'narrow' }).toUpperCase(),
          calories: dailyMap[key],
          isToday: key === todayKey
        };
      });

      setTotals(next);
      setWeekData(weekStats);
      setLoading(false);
    });

    return () => unsub();
  }, [useLocalStorage]);

  const todayCalories = totals.calories;
  const showEstimatedCalories = healthConnectEnabled && expenditureEstimateEnabled && Number.isFinite(estimatedBurnedCalories);
  const showBurnedCalories = healthConnectEnabled && (Number.isFinite(burnedCalories) || showEstimatedCalories);
  const effectiveDailyGoal = Number(dailyGoal);
  const remaining = effectiveDailyGoal - todayCalories;
  const isOverGoal = remaining < 0;

  const [weekData, setWeekData] = useState([]);

  const progress = useMemo(() => {
    const goalSafe = Number.isFinite(effectiveDailyGoal) && effectiveDailyGoal > 0 ? effectiveDailyGoal : 1;
    return Math.max(0, Math.min(1, todayCalories / goalSafe));
  }, [effectiveDailyGoal, todayCalories]);

  const size = 312;
  const ringHeight = 248;
  const stroke = 18;
  const cx = size / 2;
  const cy = 145;
  const splitStroke = showEstimatedCalories ? 10 : 14.5;
  const inwardArcExpansion = (splitStroke - 8) / 2;
  const ringRadiusX = showBurnedCalories ? 149.5 - inwardArcExpansion : 143;
  const ringRadiusY = showBurnedCalories ? 138 - inwardArcExpansion : 133;
  const createRingArc = (radiusX, radiusY, reverse = false) => {
    const arcOffsetX = radiusX / Math.SQRT2;
    const arcOffsetY = radiusY / Math.SQRT2;
    if (reverse) return `M ${cx + arcOffsetX} ${cy + arcOffsetY} A ${radiusX} ${radiusY} 0 1 0 ${cx - arcOffsetX} ${cy + arcOffsetY}`;
    return `M ${cx - arcOffsetX} ${cy + arcOffsetY} A ${radiusX} ${radiusY} 0 1 1 ${cx + arcOffsetX} ${cy + arcOffsetY}`;
  };
  const getArcLength = (radiusX, radiusY) => 0.75 * Math.PI * (3 * (radiusX + radiusY) - Math.sqrt((3 * radiusX + radiusY) * (radiusX + 3 * radiusY)));
  const ringArc = createRingArc(ringRadiusX, ringRadiusY);
  const ringLength = getArcLength(ringRadiusX, ringRadiusY);
  const burnedRadiusX = ringRadiusX - splitStroke;
  const burnedRadiusY = ringRadiusY - splitStroke;
  const burnedArc = createRingArc(burnedRadiusX, burnedRadiusY);
  const burnedRingLength = getArcLength(burnedRadiusX, burnedRadiusY);
  const burnedProgress = Math.max(0, Math.min(1, Number(burnedCalories) / (Number(dailyGoal) || 1)));
  const burnedColor = colors.macros?.carbs || colors.accent;
  const activeColor = colors.danger;
  const activeShare = Number.isFinite(activeCalories) && Number.isFinite(burnedCalories) && burnedCalories > 0
    ? Math.max(0, Math.min(1, activeCalories / burnedCalories)) : 0;
  const activeRingLength = burnedRingLength * burnedProgress * activeShare;
  const passiveRingLength = burnedRingLength * burnedProgress - activeRingLength;

  const estimatedRadiusX = burnedRadiusX - splitStroke;
  const estimatedRadiusY = burnedRadiusY - splitStroke;
  const estimatedArc = createRingArc(estimatedRadiusX, estimatedRadiusY);
  const estimatedRingLength = getArcLength(estimatedRadiusX, estimatedRadiusY);
  const estimatedProgress = Math.max(0, Math.min(1, Number(estimatedBurnedCalories) / (Number(dailyGoal) || 1)));
  const estimatedColor = colors.accent;

  // Chart settings (matching web)
  const maxChartVal = Math.max(effectiveDailyGoal, ...weekData.map(d => d.calories)) * 1.1;
  const safeMax = maxChartVal || 2000;
  const barWidth = 10;
  const barGap = 6;
  const chartWidth = weekData.length * (barWidth + barGap) - barGap;
  const startX = (size - chartWidth) / 2;
  const chartBaseY = 93;

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.muted}>{t.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info inside the Card */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 2, paddingHorizontal: 4 }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{dateStr}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 16, minWidth: 46 }}>{timeStr}</Text>
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>{mealTypeStr}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.ringWrap, { height: ringHeight * ringScale }]} onLayout={event => setRingWidth(event.nativeEvent.layout.width)}>
        <Svg width="100%" height={ringHeight * ringScale} viewBox={`0 0 ${size} ${ringHeight}`}>
          {showBurnedCalories ? (
            <>
              <Path d={ringArc} stroke={colors.border || "rgba(255,255,255,0.12)"} strokeWidth={splitStroke} fill="none" strokeLinecap="round" />
              {progress > 0 && <Path d={ringArc} stroke={colors.calories} strokeWidth={splitStroke} fill="none" strokeLinecap="round" strokeDasharray={`${ringLength * progress} ${ringLength}`} />}
              <Path d={burnedArc} stroke={colors.border || "rgba(255,255,255,0.12)"} strokeWidth={splitStroke} fill="none" strokeLinecap="round" />
              {burnedProgress > 0 && <Path d={burnedArc} stroke={burnedColor} strokeWidth={splitStroke} fill="none" strokeLinecap="round" strokeDasharray={`${burnedRingLength * burnedProgress} ${burnedRingLength}`} />}
              {activeRingLength > 0 && <Path d={burnedArc} stroke={activeColor} strokeWidth={splitStroke} fill="none" strokeLinecap="round"
                strokeDasharray={`${activeRingLength} ${burnedRingLength}`} strokeDashoffset={-passiveRingLength} />}
              {showEstimatedCalories && <>
                <Path d={estimatedArc} stroke={colors.border || "rgba(255,255,255,0.12)"} strokeWidth={splitStroke} fill="none" strokeLinecap="round" />
                {estimatedProgress > 0 && <Path d={estimatedArc} stroke={estimatedColor} strokeWidth={splitStroke} fill="none" strokeLinecap="round" strokeDasharray={`${estimatedRingLength * estimatedProgress} ${estimatedRingLength}`} />}
              </>}
            </>
          ) : (
            <>
              <Path d={ringArc} stroke={colors.border || "rgba(255,255,255,0.12)"} strokeWidth={stroke} fill="none" strokeLinecap="round" />
              {progress > 0 && <Path d={ringArc} stroke={colors.calories} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${ringLength * progress} ${ringLength}`} />}
            </>
          )}

          {/* 7-Day Mini Chart */}
          <G x={startX} y={chartBaseY}>
            {weekData.map((d, i) => {
              const GOAL_HEIGHT = 30; // Reduced height to fit better
              // Cap at 150% like HistoryScreen
              const dayGoal = d.isToday ? effectiveDailyGoal : dailyGoal;
              const pct = Math.min((d.calories / (dayGoal || 1)), 1.5);
              const barHeight = pct * GOAL_HEIGHT;
              const x = i * (barWidth + barGap);
              const isToday = d.isToday;

              return (
                <G key={i}>
                  {/* Track (Goal Background) */}
                  <Rect
                    x={x}
                    y={-GOAL_HEIGHT}
                    width={barWidth}
                    height={GOAL_HEIGHT}
                    rx={3}
                    fill={colors.border}
                  />

                  {/* Fill (Orange, or Teal for Today) */}
                  <Rect
                    x={x}
                    y={-Math.max(2, barHeight)}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    rx={3}
                    fill={colors.calories}
                  />

                  {/* Goal Marker (Blue Line at 100%) */}
                  <Rect
                    x={x}
                    y={-GOAL_HEIGHT - 1} // Centered on top edge of track roughly
                    width={barWidth}
                    height={2}
                    fill={colors.muted}
                  />

                  <SvgText
                    x={x + barWidth / 2}
                    y={14}
                    fill={colors.muted}
                    fontSize="10"
                    fontWeight={isToday ? "800" : "600"}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>

        <Pressable
          style={[styles.center, showBurnedCalories && styles.splitCenter, showEstimatedCalories && styles.estimatedCenter, { top: (showBurnedCalories ? 110 : 76) * ringScale }]}
          onPress={onPress}
        >
          {showBurnedCalories ? (
            <View style={[styles.calorieTable, { width: 204 * ringScale, transform: [{ translateX: -12 * ringScale }] }]}>
              <CalorieRow scale={ringScale} label={t.caloriesIntakeLabel} value={todayCalories} color={colors.calories} colors={colors} emphasized />
              {showEstimatedCalories && <CalorieRow scale={ringScale} label={t.caloriesDailyExpenditureLabel} value={estimatedBurnedCalories} color={estimatedColor} colors={colors} />}
              <CalorieRow scale={ringScale} label={t.caloriesBurnedLabel} value={burnedCalories} color={burnedColor} colors={colors} />
              <CalorieRow scale={ringScale} label={t.caloriesActiveLabel} value={activeCalories} color={activeColor} colors={colors} />
              <CalorieRow scale={ringScale} label={t.dailyGoalLabel} value={dailyGoal} color={colors.muted} colors={colors} secondary />
              <CalorieRow scale={ringScale} label={isOverGoal ? t.overGoal : t.remainingLabel} value={Math.abs(remaining)} color={isOverGoal ? colors.danger : colors.muted} colors={colors} secondary />
            </View>
          ) : (
            <>
              <View style={styles.centerRow}>
                <Text style={[styles.kcalValue, { color: colors.calories }]}>{Math.round(todayCalories).toLocaleString()}</Text>
                <Text style={[styles.kcalUnit, { color: colors.calories }]}>kcal</Text>
              </View>
              <Text style={[styles.goalText, { color: colors.muted }]}>{t.dailyGoalLabel}: {Number(dailyGoal).toLocaleString()} kcal</Text>
              <Text style={[styles.remainingText, { color: isOverGoal ? colors.danger : colors.muted }]}>
                {Math.round(Math.abs(remaining)).toLocaleString()} kcal {isOverGoal ? t.overGoal : t.remainingLabel}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={[styles.macros, { borderTopColor: colors.border }]}>
        {['protein', 'carbs', 'fat'].map(key => <Macro key={key} label={t[key]} value={totals[key]} goal={macroGoals[key]} color={colors.macros[key]} colors={colors} goalLabel={t.dailyGoalLabel} onPress={onPress} />)}
      </View>
    </View>
  );
}

function CalorieRow({ label, value, color, colors, secondary = false, emphasized = false, scale = 1 }) {
  // Explicit line boxes avoid platform font metrics overflowing neighbouring rows.
  // Scale the grid with the ring; each cell can also shrink long labels/numbers.
  const rowHeight = (emphasized ? 28 : secondary ? 18 : 24) * scale;
  const valueSize = (emphasized ? 26.4 : secondary ? 16.5 : 22) * scale;
  return <View style={[styles.calorieTableRow, { height: rowHeight, gap: 3 * scale }]}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}
      style={[styles.tableLabel, { color: colors.muted, fontSize: 13.2 * scale, lineHeight: 17 * scale }]}>{label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}
      style={[styles.tableValue, { width: 80 * scale, color, fontSize: valueSize, lineHeight: rowHeight, fontWeight: secondary ? '600' : '800' }]}>
      {Number.isFinite(Number(value)) && value != null ? Math.round(Number(value)).toLocaleString() : '—'}
    </Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}
      style={[styles.tableUnit, { width: 25 * scale, color, fontSize: 11 * scale, lineHeight: 15 * scale, marginBottom: 2 * scale }]}>kcal</Text>
  </View>;
}

function Macro({ label, value, goal, color, colors, goalLabel, onPress }) {
  const progress = Math.max(0, Math.min(1, value / goal));
  const radius = 40;
  const offset = radius / Math.sqrt(2);
  const arc = `M ${50 - offset} ${41 + offset} A ${radius} ${radius} 0 1 1 ${50 + offset} ${41 + offset}`;
  const length = 1.5 * Math.PI * radius;
  return (
    <Pressable style={styles.macroItem} accessible accessibilityRole="button" accessibilityLabel={`${label}: ${Math.round(value)}g. ${goalLabel}: ${goal}g`} onPress={onPress}>
      <Svg width="100%" height={64} viewBox="0 -3 100 80" accessible={false}>
        <Path d={arc} stroke={color} strokeOpacity={0.15} strokeWidth={7.7} fill="none" strokeLinecap="round" />
        {progress > 0 && <Path d={arc} stroke={color} strokeWidth={7.7} fill="none" strokeLinecap="round" strokeDasharray={`${length * progress} ${length}`} />}
        <SvgText x={50} y={40} textAnchor="middle" fill={colors.muted} fontSize={Math.round(value) >= 1000 ? 20.05 : 24.05} fontWeight="800">{`${Math.round(value)}g`}</SvgText>
        <SvgText x={50} y={61} textAnchor="middle" fill={colors.muted} fontSize={16} fontWeight="800">{`${goal}g`}</SvgText>
      </Svg>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.macroLabel, { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  muted: {
    color: 'rgba(255,255,255,0.7)',
  },
  ringWrap: {
    width: 312,
    maxWidth: '100%',
    height: 248,
  },
  center: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  splitCenter: {
    top: 111,
    gap: 1,
  },
  estimatedCenter: {
    top: 112,
    bottom: 0,
    gap: 0,
  },
  calorieTable: { width: 204, maxWidth: '100%', transform: [{ translateX: -12 }] },
  calorieTableRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  tableLabel: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13.2, fontWeight: '600', includeFontPadding: false },
  tableValue: { width: 80, includeFontPadding: false, textAlign: 'right', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tableUnit: { width: 25, fontSize: 11, fontWeight: '600', includeFontPadding: false },
  estimatedLabeledRow: {
    maxWidth: 174,
  },
  splitLabeledRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  calorieCaption: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  splitCenterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  splitKcalValue: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 30,
  },
  estimatedIntakeValue: {
    fontSize: 22,
    lineHeight: 25,
  },
  splitKcalUnit: {
    fontSize: 11,
    fontWeight: '700',
  },
  burnedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  burnedKcalValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  burnedKcalUnit: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
    transform: [{ translateY: 4 / 3 }],
  },
  kcalValue: {
    fontSize: 44,
    fontWeight: '800',
  },
  kcalUnit: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalText: {
    fontSize: 14,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '800',
  },
  remainingOver: {
    color: '#F87171',
  },
  macros: {
    height: 92,
    marginTop: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 0,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  macroLabel: {
    fontSize: 17.95,
  },
});
