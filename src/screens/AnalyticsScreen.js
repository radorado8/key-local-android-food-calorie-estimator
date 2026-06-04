import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { readBurnedCaloriesPerDay, isHealthConnectAvailable, requestHealthPermissions } from '../api/healthConnectService';
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
    const { theme, dailyGoal, useLocalStorage, language, healthConnectEnabled, setHealthConnectEnabled } = useSettings();
    const { width: screenWidth } = useWindowDimensions();

    const colors = theme === 'light'
        ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)', elemBg: '#F1F5F9' }
        : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)', elemBg: 'rgba(255,255,255,0.08)' };

    const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
    const [meals, setMeals] = useState([]);
    const [burnedPerDay, setBurnedPerDay] = useState({});
    const [hcAvailable, setHcAvailable] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        (async () => {
            const avail = await isHealthConnectAvailable();
            setHcAvailable(avail);
        })();
    }, []);

    const syncHealthConnect = useCallback(async () => {
        setIsSyncing(true);
        try {
            const available = await isHealthConnectAvailable();
            if (!available) {
                setIsSyncing(false);
                return;
            }
            let permitted = healthConnectEnabled;
            if (!permitted) {
                permitted = await requestHealthPermissions();
                if (permitted) {
                    setHealthConnectEnabled(true);
                }
            }
            if (permitted) {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 31);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                const data = await readBurnedCaloriesPerDay(start, end);
                setBurnedPerDay(data);
            }
        } catch (error) {
            console.warn('Sync error:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [healthConnectEnabled, setHealthConnectEnabled]);

    useEffect(() => {
        const unsub = subscribeToMeals(useLocalStorage, (fetched) => {
            setMeals(fetched || []);
        });
        return () => unsub();
    }, [useLocalStorage]);

    // Load burned calories from Health Connect
    useEffect(() => {
        if (!healthConnectEnabled) { setBurnedPerDay({}); return; }
        (async () => {
            const available = await isHealthConnectAvailable();
            if (!available) return;
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 31);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            const data = await readBurnedCaloriesPerDay(start, end);
            setBurnedPerDay(data);
        })();
    }, [healthConnectEnabled]);

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
                burned: burnedPerDay[key] || 0,
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
    }, [meals, numDays, viewMode, language, burnedPerDay]);

    const summary = useMemo(() => {
        const daysWithData = dailyData.filter(d => d.calories > 0);
        const totalCals = dailyData.reduce((s, d) => s + d.calories, 0);
        const totalProtein = dailyData.reduce((s, d) => s + d.protein, 0);
        const totalCarbs = dailyData.reduce((s, d) => s + d.carbs, 0);
        const totalFat = dailyData.reduce((s, d) => s + d.fat, 0);
        const totalBurned = dailyData.reduce((s, d) => s + d.burned, 0);
        const avgCals = daysWithData.length > 0 ? Math.round(totalCals / daysWithData.length) : 0;
        const highest = daysWithData.length > 0 ? Math.max(...daysWithData.map(d => d.calories)) : 0;
        const lowest = daysWithData.length > 0 ? Math.min(...daysWithData.map(d => d.calories)) : 0;
        return { totalCals, totalProtein, totalCarbs, totalFat, totalBurned, avgCals, highest, lowest, daysTracked: daysWithData.length };
    }, [dailyData]);

    // ---- BAR CHART ----
    const chartPadding = { left: 40, right: 16, top: 20, bottom: 30 };
    const chartW = screenWidth - 32 - chartPadding.left - chartPadding.right;
    const chartH = 180;
    const maxVal = Math.max(dailyGoal * 1.3, ...dailyData.map(d => d.calories)) || 2000;
    const barW = Math.max(4, (chartW / dailyData.length) - (viewMode === 'week' ? 12 : 2));
    const barGap = viewMode === 'week' ? 12 : 2;
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
                        <Text style={[styles.segmentText, { color: viewMode === 'week' ? '#FFF' : colors.muted }]}>{t.weekView || 'Týždeň'}</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segmentBtn, viewMode === 'month' && [styles.segmentActive, { backgroundColor: colors.accent }]]}
                        onPress={() => setViewMode('month')}
                    >
                        <Text style={[styles.segmentText, { color: viewMode === 'month' ? '#FFF' : colors.muted }]}>{t.monthView || 'Mesiac'}</Text>
                    </Pressable>
                </View>

                {/* Bar Chart Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{t.caloriesChart || 'Kalórie'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Svg
                            width={chartPadding.left + dailyData.length * (barW + barGap) + chartPadding.right}
                            height={chartH + chartPadding.top + chartPadding.bottom}
                        >
                            <G x={chartPadding.left} y={chartPadding.top}>
                                {/* Y-axis labels */}
                                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                                    const yVal = Math.round(maxVal * pct);
                                    const yPos = chartH - pct * chartH;
                                    return (
                                        <G key={i}>
                                            <Line x1={-4} y1={yPos} x2={dailyData.length * (barW + barGap)} y2={yPos} stroke={colors.border} strokeWidth={1} />
                                            <SvgText x={-8} y={yPos + 4} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">{yVal}</SvgText>
                                        </G>
                                    );
                                })}

                                {/* Goal line */}
                                <Line
                                    x1={-4} y1={goalY} x2={dailyData.length * (barW + barGap)} y2={goalY}
                                    stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6,4"
                                />

                                {/* Bars */}
                                {dailyData.map((d, i) => {
                                    const barH = Math.max(2, (d.calories / maxVal) * chartH);
                                    const x = i * (barW + barGap);
                                    const isOver = d.calories > dailyGoal;
                                    const barColor = d.isToday ? colors.accent : (isOver ? '#F87171' : '#FB923C');

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
                    </ScrollView>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#FB923C' }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.caloriesLabel || 'Kalórie'}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.dailyGoalLabel || 'Denný cieľ'}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#F87171' }]} />
                            <Text style={[styles.legendText, { color: colors.muted }]}>{t.overGoalLabel || 'Nad cieľom'}</Text>
                        </View>
                    </View>
                </View>

                {/* Summary Cards Row */}
                <View style={styles.summaryRow}>
                    <SummaryCard label={t.totalCalories || 'Celkové kalórie'} value={`${summary.totalCals}`} unit="kcal" icon="nutrition" iconColor="#10B981" colors={colors} />
                    <SummaryCard label={t.avgCalories || 'Priemer/deň'} value={`${summary.avgCals}`} unit="kcal" icon="flame" iconColor="#FB923C" colors={colors} />
                </View>
                <View style={styles.summaryRow}>
                    <SummaryCard label={t.daysTracked || 'Sledované dni'} value={`${summary.daysTracked}`} unit={`/ ${numDays}`} icon="calendar" iconColor={colors.accent} colors={colors} />
                    <SummaryCard label={t.highestDay || 'Najvyšší deň'} value={`${summary.highest}`} unit="kcal" icon="arrow-up" iconColor="#F87171" colors={colors} />
                </View>
                <View style={styles.summaryRow}>
                    <SummaryCard label={t.lowestDay || 'Najnižší deň'} value={`${summary.lowest}`} unit="kcal" icon="arrow-down" iconColor="#4ADE80" colors={colors} />
                </View>

                {/* Health Connect burned calories */}
                {hcAvailable && (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.burnedRow}>
                            <Ionicons name="fitness" size={24} color="#F472B6" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 2 }]}>{t.burnedCalories || 'Spálené kalórie'}</Text>
                                <Text style={{ color: colors.muted, fontSize: 13 }}>Google Health Connect</Text>
                            </View>
                            {healthConnectEnabled ? (
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                                    <Text style={{ color: '#F472B6', fontSize: 22, fontWeight: '800' }}>{Math.round(summary.totalBurned)}</Text>
                                    <Text style={{ color: colors.muted, fontSize: 13 }}>kcal</Text>
                                </View>
                            ) : (
                                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '500' }}>{t.notConnected || 'Neprepojené'}</Text>
                            )}
                        </View>

                        <Pressable
                            style={[
                                styles.syncBtn,
                                {
                                    backgroundColor: colors.elemBg,
                                    borderColor: colors.border,
                                    marginTop: 12,
                                    opacity: isSyncing ? 0.6 : 1,
                                }
                            ]}
                            disabled={isSyncing}
                            onPress={syncHealthConnect}
                        >
                            {isSyncing ? (
                                <Text style={[styles.syncBtnText, { color: colors.text }]}>{t.syncing || 'Preberám...'}</Text>
                            ) : (
                                <>
                                    <Ionicons name="sync-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                                    <Text style={[styles.syncBtnText, { color: colors.text }]}>
                                        {healthConnectEnabled ? (t.downloadBurnedCalories || 'Stiahnuť spálené kalórie') : (t.connectHealthConnect || 'Prepojiť Google Health')}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}

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
                                        stroke="#2DD4BF" strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Carbs arc */}
                                {totalMacroG > 0 && carbsAngle > 0.5 && (
                                    <Path
                                        d={makeDonutPath(proteinAngle, Math.min(proteinAngle + carbsAngle, 359.9), donutR, donutCx, donutCy)}
                                        stroke="#F472B6" strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Fat arc */}
                                {totalMacroG > 0 && fatPct > 0.01 && (
                                    <Path
                                        d={makeDonutPath(proteinAngle + carbsAngle, Math.min(360, 359.9), donutR, donutCx, donutCy)}
                                        stroke={theme === 'light' ? '#94A3B8' : '#CBD5E1'} strokeWidth={donutStroke} fill="none" strokeLinecap="round"
                                    />
                                )}
                                {/* Center text */}
                                <SvgText x={donutCx} y={donutCy - 4} fill={colors.text} fontSize="18" fontWeight="800" textAnchor="middle">
                                    {Math.round(totalMacroG)}g
                                </SvgText>
                                <SvgText x={donutCx} y={donutCy + 14} fill={colors.muted} fontSize="11" fontWeight="600" textAnchor="middle">
                                    {t.totalLabel || 'Celkom'}
                                </SvgText>
                            </Svg>
                        </View>

                        <View style={styles.macroDetails}>
                            <MacroRow label={t.protein || 'Bielkoviny'} value={Math.round(summary.totalProtein)} pct={Math.round(proteinPct * 100)} color="#2DD4BF" colors={colors} />
                            <MacroRow label={t.carbs || 'Sacharidy'} value={Math.round(summary.totalCarbs)} pct={Math.round(carbsPct * 100)} color="#F472B6" colors={colors} />
                            <MacroRow label={t.fat || 'Tuky'} value={Math.round(summary.totalFat)} pct={Math.round(fatPct * 100)} color={theme === 'light' ? '#94A3B8' : '#CBD5E1'} colors={colors} />
                        </View>
                    </View>
                </View>

                {/* Net calories card */}
                {healthConnectEnabled && (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{t.netCalories || 'Čisté kalórie'}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ color: '#FB923C', fontSize: 20, fontWeight: '800' }}>{Math.round(summary.totalCals)}</Text>
                                <Text style={{ color: colors.muted, fontSize: 12 }}>{t.consumed || 'Prijaté'}</Text>
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 20, fontWeight: '300' }}>−</Text>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ color: '#F472B6', fontSize: 20, fontWeight: '800' }}>{Math.round(summary.totalBurned)}</Text>
                                <Text style={{ color: colors.muted, fontSize: 12 }}>{t.burnedLabel || 'Spálené'}</Text>
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 20, fontWeight: '300' }}>=</Text>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '900' }}>{Math.round(summary.totalCals - summary.totalBurned)}</Text>
                                <Text style={{ color: colors.muted, fontSize: 12 }}>{t.netLabel || 'Čisté'}</Text>
                            </View>
                        </View>
                    </View>
                )}

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
    headerTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
    content: { padding: 16, paddingBottom: 100, gap: 12 },
    segmentContainer: {
        flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    },
    segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { borderRadius: 10, margin: 2 },
    segmentText: { fontWeight: '700', fontSize: 14 },
    card: { padding: 16, borderRadius: 16, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
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
    burnedRow: { flexDirection: 'row', alignItems: 'center' },
    syncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    syncBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
