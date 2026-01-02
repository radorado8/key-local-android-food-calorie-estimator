import React from 'react';
import { Pressable, StyleSheet, Text, View, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';

function fmt(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  // If digits is 0, we want an integer.
  return digits ? v.toFixed(digits) : String(Math.round(v));
}

export default function NutritionResultCard({ data, imageUri, todayCalories = 0, dailyGoal = 2000, onSave, onReset, onChange, saving, theme, colors }) {
  const t = useTranslation();
  if (!data) return null;

  const currentTotal = Number(todayCalories) || 0;
  const goal = Number(dailyGoal) || 2000;
  const foodCals = Number(data.calories) || 0;
  const newTotal = currentTotal + foodCals;
  const isOver = newTotal > goal;
  const diff = Math.abs(goal - newTotal);

  const confidencePct = Number.isFinite(Number(data.confidence)) ? Math.round(Number(data.confidence) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.analysisResult}</Text>
      </View>

      {/* Header: Image + Title */}
      <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.thumbWrapper}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.elemBg, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="fast-food-outline" size={24} color={colors.muted} />
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <TextInput
            value={data.name || ''}
            onChangeText={(v) => onChange && onChange({ ...data, name: v })}
            style={[styles.title, { color: colors.text, padding: 0 }]}
            placeholder={t.unknownFood}
            placeholderTextColor={colors.muted}
            multiline
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t.confidence || 'Zhoda'}: {confidencePct}%</Text>
          </View>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {/* Big Stat (Calories + Prediction) */}
        <View style={[styles.card, styles.bigCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.mainStatRow, { borderBottomColor: colors.elemBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(251, 146, 60, 0.1)' }]}>
              <Ionicons name="flame" size={24} color="#FB923C" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.label, { color: colors.muted }]}>{t.calories}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <TextInput
                  value={String(Math.round(Number(data.calories || 0)))}
                  onChangeText={(v) => onChange && onChange({ ...data, calories: v.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  textAlignVertical="bottom"
                  style={[styles.valueLarge, { color: colors.text, padding: 0, paddingVertical: 0, includeFontPadding: false, minWidth: 40 }]}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.valueLarge, { color: colors.text, marginLeft: 2, fontSize: 18, includeFontPadding: false, marginBottom: 2 }]}>kcal</Text>
              </View>
            </View>
          </View>

          <View style={styles.predictionBlock}>
            <Row label={(t.currentTotal || 'Dnes') + ':'} value={`${fmt(currentTotal)} kcal`} colors={colors} />
            <Row label={t.dailyGoalLabel || 'Cieľ:'} value={`${fmt(goal)} kcal`} bold colors={colors} />

            <View style={[styles.predictionRow, styles.highlightRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.pLabel, { color: colors.muted }]}>{t.afterAdding || 'Po pridaní:'}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pValueHighlight, { color: colors.accent }]}>{fmt(newTotal)} kcal</Text>
                <Text style={[styles.pDiff, { color: isOver ? '#F87171' : '#4ADE80' }]}>
                  {isOver ? `(${diff} ${t.overGoal})` : `(${diff} ${t.remainingLabel})`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Weight - Always visible if editable or present. Better to show always if we want ability to add weight? User said "zmenit vsetky polia". */}
        {(true) && (
          <StatCard
            label={t.weightLabel || 'Váha'}
            value={String(data.weight_g || '')}
            onChangeText={(v) => onChange && onChange({ ...data, weight_g: v.replace(/[^0-9.]/g, '') })}
            unit="g"
            icon={<Text style={{ fontWeight: '900', color: colors.text }}>g</Text>}
            iconBg="rgba(150, 150, 150, 0.1)"
            colors={colors}
            editable
          />
        )}

        {/* Protein */}
        <StatCard
          label={t.protein}
          value={String(Math.round(Number(data.protein || 0)))}
          onChangeText={(v) => onChange && onChange({ ...data, protein: v.replace(/[^0-9]/g, '') })}
          unit="g"
          icon={<Ionicons name="flash" size={18} color="#2DD4BF" />}
          iconBg="rgba(45, 212, 191, 0.1)"
          colors={colors}
          progress={0.8}
          progressColor="#2DD4BF"
          editable
        />

        {/* Carbs */}
        <StatCard
          label={t.carbs}
          value={String(Math.round(Number(data.carbs || 0)))}
          onChangeText={(v) => onChange && onChange({ ...data, carbs: v.replace(/[^0-9]/g, '') })}
          unit="g"
          icon={<Ionicons name="pulse" size={18} color="#F472B6" />}
          iconBg="rgba(244, 114, 182, 0.1)"
          colors={colors}
          progress={0.4}
          progressColor="#F472B6"
          editable
        />

        {/* Fat */}
        <StatCard
          label={t.fat}
          value={String(Math.round(Number(data.fat || 0)))}
          onChangeText={(v) => onChange && onChange({ ...data, fat: v.replace(/[^0-9]/g, '') })}
          unit="g"
          icon={<Text style={{ fontWeight: '900', color: colors.text }}>T</Text>}
          iconBg="rgba(150, 150, 150, 0.1)"
          colors={colors}
          progress={0.5}
          progressColor={colors.muted}
          editable
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnGhost,
            { backgroundColor: colors.elemBg, borderColor: colors.elemBorder },
            pressed && styles.btnPressed
          ]}
          onPress={onReset}
        >
          <Ionicons name="refresh" size={18} color={colors.text} />
          <Text style={[styles.btnGhostText, { color: colors.text }]}>{t.back}</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: colors.accent },
            pressed && styles.btnPressed,
            saving && styles.btnDisabled
          ]}
          onPress={onSave}
        >
          <Ionicons name={saving ? "time" : "save"} size={18} color={theme === 'light' ? 'white' : 'black'} />
          <Text style={[styles.btnPrimaryText, theme === 'light' && { color: 'white' }]}>{saving ? t.saving : t.saveToLog}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, bold, colors }) {
  return (
    <View style={styles.predictionRow}>
      <Text style={[styles.pLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.pValue, { color: colors.text, fontWeight: bold ? '700' : '500' }]}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, unit, icon, iconBg, colors, progress, progressColor, editable, onChangeText }) {
  return (
    <View style={[styles.card, styles.smallCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.statContent}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          {editable ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType="numeric"
                textAlignVertical="bottom"
                style={[styles.valueSmall, { color: colors.text, padding: 0, paddingVertical: 0, includeFontPadding: false, minWidth: 20 }]}
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.valueSmall, { color: colors.text, fontSize: 13, marginLeft: 2, includeFontPadding: false, marginBottom: 1 }]}>{unit}</Text>
            </View>
          ) : (
            <Text style={[styles.valueSmall, { color: colors.text }]}>{value}<Text style={styles.unit}>{unit}</Text></Text>
          )}
        </View>
      </View>
      {progress !== undefined && (
        <View style={[styles.progressBar, { backgroundColor: colors.elemBg }]}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: progressColor }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  screenHeader: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  thumbWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#4ADE80',
    fontWeight: '700',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  bigCard: {
    width: '100%',
    gap: 12,
  },
  smallCard: {
    flex: 1,
    minWidth: '45%',
    gap: 8,
  },
  mainStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 13,
    marginBottom: 2,
  },
  valueLarge: {
    fontSize: 24,
    fontWeight: '800',
  },
  valueSmall: {
    fontSize: 18,
    fontWeight: '800',
  },
  unit: {
    fontSize: 12,
    marginLeft: 2,
    fontWeight: '600',
  },
  predictionBlock: {
    gap: 6,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  highlightRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderStyle: 'dashed', // dashed borders not fully supported same as web, but solid works
  },
  pLabel: {
    fontSize: 13,
  },
  pValue: {
    fontSize: 14,
  },
  pValueHighlight: {
    fontSize: 16,
    fontWeight: '800',
  },
  pDiff: {
    fontSize: 11,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  actions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
  btnGhost: {
    borderWidth: 1,
  },
  btnGhostText: {
    fontWeight: '800',
    fontSize: 15,
  },
  btnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
    opacity: 0.96,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
