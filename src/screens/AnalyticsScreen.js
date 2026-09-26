import { typography } from '../theme/palette';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, G, Line, Text as SvgText, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToMeals } from '../api/mealService';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';

function getLocalDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export default function AnalyticsScreen() {
    const t = useTranslation();
    const { theme, dailyGoal, useLocalStorage, language } = useSettings();
    const { width: screenWidth } = useWindowDimensions();

    const { colors } = useSettings();

    const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
    const [meals, setMeals] = useState([]);
    const [chartWidth, setChartWidth] = useState(Math.max(240, screenWidth - 64));

    useEffect(() => {
        const unsub = subscribeToMeals(useLocalStorage, (fetched) => {
            setMeals(fetched || []);
        });
        return () => unsub();
    }, [useLocalStorage]);

    const numDays = viewMode === 'week' ? 7 : 30;

    const dailyData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = [];

        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = getLocalDateKey(d);
            days.push({
                key,
                date: new Date(d),
                label: viewMode === 'week'
                    ? d.toLocaleDateString(language, { weekday: 'short' })
                    : `${d.getDate()}`,
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                isToday: i === 0,
            });
        }

        meals.forEach(m => {
            const mealDate = m.dateObj || new Date(m.timestamp);
            const key = getLocalDateKey(mealDate);
            const dayEntry = days.find(d => d.key === key);
            if (dayEntry) {
                dayEntry.calories += Number(m.calories) || 0;
                dayEntry.protein += Number(m.protein) || 0;
                dayEntry.carbs += Number(m.carbs) || 0;
                dayEntry.fat += Number(m.fat) || 0;
            }
        });

        return days;
    }, [meals, numDays, viewMode, language]);

    const summary = useMemo(() => {
        const daysWithData = dailyData.filter(d => d.calories > 0);
        const totalCals = dailyData.reduce((s, d) => s + d.calories, 0);
        const totalProtein = dailyData.reduce((s, d) => s + d.protein, 0);
        const totalCarbs = dailyData.reduce((s, d) => s + d.carbs, 0);
        const totalFat = dailyData.reduce((s, d) => s + d.fat, 0);
        const avgCals = daysWithData.length > 0 ? Math.round(totalCals / daysWithData.length) : 0;
        const highest = daysWithData.length > 0 ? Math.max(...daysWithData.map(d => d.calories)) : 0;
        const lowest = daysWithData.length > 0 ? Math.min(...daysWithData.map(d => d.calories)) : 0;
        return { totalCals, totalProtein, totalCarbs, totalFat, avgCals, highest, lowest, daysTracked: daysWithData.length };
    }, [dailyData]);

    // ---- BAR CHART ----
    const chartPadding = { left: 40, right: 16, top: 20, bottom: 30 };
    const chartW = Math.max(1, chartWidth - chartPadding.left - chartPadding.right);
    const chartH = 180;
    const maxVal = Math.max(dailyGoal * 1.3, ...dailyData.map(d => d.calories)) || 2000;
    const barGap = viewMode === 'week' ? 8 : 2;
    const barW = Math.max(1, (chartW - barGap * (dailyData.length - 1)) / dailyData.length);
    const goalY = chartH - (dailyGoal / maxVal) * chartH;

    // ---- DONUT CHART ----
    const donutSize = 160;
    const donutR = 58;
    const donutStroke = 20;
    const totalMacroG = summary.totalProtein + summary.totalCarbs + summary.totalFat;

    const makeDonutPath = (startAngle, endAngle, radius, cx, cy) => {
        const start = polarToCartesian(cx, cy, radius, endAngle);
        const end = polarToCartesian(cx, cy, radius, startAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
    };

    const polarToCartesian = (cx, cy, r, angleDeg) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const proteinPct = totalMacroG > 0 ? summary.totalProtein / totalMacroG : 0.33;
    const carbsPct = totalMacroG > 0 ? summary.totalCarbs / totalMacroG : 0.33;
    const fatPct = totalMacroG > 0 ? summary.totalFat / totalMacroG : 0.34;

    const proteinAngle = proteinPct * 360;
    const carbsAngle = carbsPct * 360;
    // fatAngle fills the rest

    const donutCx = donutSize / 2;
    const donutCy = donutSize / 2;

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
            <View style={styles.headerBlock}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t.analyticsTitle || 'Analýza'}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Period Selector */}
                <View style={[styles.segmentContainer, { backgroundColor: colors.elemBg, borderColor: colors.border }]}>
                    <Pressable
                        style={[styles.segmentBtn, viewMode === 'week' && [styles.segmentActive, { backgroundColor: colors.accent }]]}
                        onPress={() => setViewMode('week')}
                    >
                        <Text style={[styles.segmentText, { color: viewMode === 'week' ? colors.onAccent : colors.muted }]}>{t.weekView || 'Týždeň'}</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segmentBtn, viewMode === 'month' && [styles.segmentActive, { backgroundColor: colors.accent }]]}
                        onPress={() => setViewMode('month')}
                    >
                        <Text style={[styles.segmentText, { color: viewMode === 'month' ? colors.onAccent : colors.muted }]}>{t.monthView || 'Mesiac'}</Text>
                    </Pressable>
                </View>

                {/* Bar Chart Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                        <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>{t.caloriesChart || 'Kalórie'}</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.chartDays, { color: colors.muted }]}>
                            {t.daysTracked || 'Sledované dni'}: {summary.daysTracked}/{numDays}
                        </Text>
                    </View>
                    <View onLayout={event => setChartWidth(event.nativeEvent.layout.width)}>
                        <Svg
                            width="100%"
                            height={chartH + chartPadding.top + chartPadding.bottom}
                            viewBox={`0 0 ${chartWidth} ${chartH + chartPadding.top + chartPadding.bottom}`}
                        >
                            <G x={chartPadding.left} y={chartPadding.top}>
                                {/* Y-axis labels */}
                                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                                    const yVal = Math.round(maxVal * pct);
                                    const yPos = chartH - pct * chartH;
                                    return (
                                        <G key={i}>
                                            <Line x1={-4} y1={yPos} x2={chartW} y2={yPos} stroke={colors.border} strokeWidth={1} />
                                            <SvgText x={-8} y={yPos + 4} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">{yVal}</SvgText>
                                        </G>
                                    );
                                })}

                                {/* Goal line */}
                                <Line
                                    x1={-4} y1={goalY} x2={chartW} y2={goalY}
                                    stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6,4"
                                />

                                {/* Bars */}
                                {dailyData.map((d, i) => {
                                    const barH = Math.max(2, (d.calories / maxVal) * chartH);
                                    const x = i * (barW + barGap);
                                    const isOver = d.calories > dailyGoal;
                                    const barColor = d.isToday ? colors.accent : (isOver ? colors.danger : colors.calories);

                                    return (
                                        <G key={d.key}>
                                            <Rect x={x} y={chartH - barH} width={barW} height={barH} rx={viewMode === 'week' ? 4 : 2} fill={barColor} />
                                            {viewMode === 'week' && (
                                                <SvgText
                                                    x={x + barW / 2} y={chartH + 16}
                                                    fill={d.isToday ? colors.accent : colors.muted}
                                                    fontSize="10" fontWeight={d.isToday ? '800' : '600'} textAnchor="middle"
                                                >{d.label}</SvgText>
                                            )}
                                            {viewMode === 'month' && i % 5 === 0 && (
                                                <SvgText
                                                    x={x + barW / 2} y={chartH + 14}
                                                    fill={colors.muted}
                                                    fontSize="9" fontWeight="600" textAnchor="middle"
                                                >{d.label}</SvgText>
                                            )}
                                        </G>
                                    );
                                })}
                            </G>
                        </Svg>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.calories }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.caloriesLabel || 'Kalórie'}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.dailyGoalLabel || 'Denný cieľ'}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.overGoalLabel || 'Nad cieľom'}</Text>
                        </View>
                    </View>
                </View>

                {/* Summary Cards Row */}
                <View style={styles.summaryRow}>
                    <SummaryCard label={t.totalCalories || 'Celkové kalórie'} value={`${summary.totalCals}`} unit="kcal" icon="nutrition" iconColor={colors.accent} colors={colors} />
                    <SummaryCard label={t.avgCalories || 'Priemer/deň'} value={`${summary.avgCals}`} unit="kcal" icon="flame" iconColor={colors.calories} colors={colors} />
                </View>
                <View style={styles.summaryRow}>
                    <SummaryCard label={t.lowestDay || 'Najnižší deň'} value={`${summary.lowest}`} unit="kcal" icon="arrow-down" iconColor={colors.accent} colors={colors} />
                    <SummaryCard label={t.highestDay || 'Najvyšší deň'} value={`${summary.highest}`} unit="kcal" icon="arrow-up" iconColor={colors.danger} colors={colors} />
                </View>

                {/* Macros Donut + Details */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{t.macroSummary || 'Makroživiny'}</Text>
                    <View style={styles.donutSection}>
                        <View style={{ alignItems: 'center' }}>
                            <Svg width={donutSize} height={donutSize}>
                                {/* Background circle */}
                                <Circle cx={donutCx} cy={donutCy} r={donutR} stroke={colors.elemBg} strokeWidth={donutStroke} fill="none" />
                                {/* Protein arc */}
                                {totalMacroG > 0 && proteinAngle > 0.5 && (
                                    <Path
                                        d={makeDonutPath(0, Math.min(proteinAngle, 359.9), donutR, donutCx, donutCy)}
                                        stroke={colors.macros.protein} strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Carbs arc */}
                                {totalMacroG > 0 && carbsAngle > 0.5 && (
                                    <Path
                                        d={makeDonutPath(proteinAngle, Math.min(proteinAngle + carbsAngle, 359.9), donutR, donutCx, donutCy)}
                                        stroke={colors.macros.carbs} strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Fat arc */}
                                {totalMacroG > 0 && fatPct > 0.01 && (
                                    <Path
                                        d={makeDonutPath(proteinAngle + carbsAngle, Math.min(360, 359.9), donutR, donutCx, donutCy)}
                                        stroke={colors.macros.fat} strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Center text */}
                                <SvgText x={donutCx} y={donutCy - 4} fill={colors.text} fontSize="18" fontWeight="800" textAnchor="middle">
                                    {`${Math.round(totalMacroG)}g`}
                                </SvgText>
                                <SvgText x={donutCx} y={donutCy + 16} fill={colors.muted} fontSize="11" fontWeight="600" textAnchor="middle">
                                    {t.totalLabel || 'Celkom'}
                                </SvgText>
                            </Svg>
                        </View>

                        <View style={styles.macroDetails}>
                            <MacroRow label={t.protein || 'Bielkoviny'} value={Math.round(summary.totalProtein)} pct={Math.round(proteinPct * 100)} color={colors.macros.protein} colors={colors} />
                            <MacroRow label={t.carbs || 'Sacharidy'} value={Math.round(summary.totalCarbs)} pct={Math.round(carbsPct * 100)} color={colors.macros.carbs} colors={colors} />
                            <MacroRow label={t.fat || 'Tuky'} value={Math.round(summary.totalFat)} pct={Math.round(fatPct * 100)} color={colors.macros.fat} colors={colors} />
                        </View>
                    </View>
                </View>

                {dailyData.every(d => d.calories === 0) && (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 30 }]}>
                        <Ionicons name="analytics-outline" size={40} color={colors.muted} />
                        <Text style={{ color: colors.muted, marginTop: 10, fontSize: 14, textAlign: 'center' }}>{t.noDataForPeriod || 'Žiadne dáta za toto obdobie'}</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function SummaryCard({ label, value, unit, icon, iconColor, colors }) {
    return (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: iconColor + '18' }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{unit}</Text>
            </View>
        </View>
    );
}

function MacroRow({ label, value, pct, color, colors }) {
    return (
        <View style={styles.macroRow}>
            <View style={[styles.macroDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{value}g</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{pct}%</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    headerBlock: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, alignItems: 'center' },
    headerTitle: { ...typography.screenTitle, textAlign: 'center' },
    content: { padding: 16, paddingBottom: 100, gap: 12 },
    segmentContainer: {
        flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    },
    segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { borderRadius: 10, margin: 2 },
    segmentText: { fontWeight: '700', fontSize: 14 },
    card: { padding: 16, borderRadius: 18, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
    chartHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
    chartDays: { flexShrink: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '600' },
    summaryRow: { flexDirection: 'row', gap: 12 },
    summaryCard: {
        flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, gap: 6,
    },
    summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    summaryLabel: { fontSize: 12, fontWeight: '600' },
    summaryValue: { fontSize: 22, fontWeight: '800' },
    donutSection: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    macroDetails: { flex: 1, gap: 12 },
    macroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    macroDot: { width: 10, height: 10, borderRadius: 5 },
});
