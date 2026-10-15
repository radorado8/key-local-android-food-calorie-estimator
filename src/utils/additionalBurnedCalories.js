import { validEnergy } from './calorieExpenditure';

export function additionalBurnedForDay(history, date) {
  return validEnergy(history?.[date]?.additionalCalories) ?? 0;
}

export function adjustedBurnedTotal(base, additional) {
  const extra = validEnergy(additional) ?? 0;
  return validEnergy(base) !== null ? base + extra : extra > 0 ? extra : null;
}

export function setBurnedAdjustment(entry, additional, healthBase = null, countsAsActive = entry?.additionalCountsAsActive === true, healthActive = null) {
  const extra = validEnergy(additional) ?? 0;
  const previousExtra = validEnergy(entry?.additionalCalories) ?? 0;
  const base = validEnergy(healthBase) ?? (entry?.baseCalories === null ? null
    : validEnergy(entry?.baseCalories) ?? (validEnergy(entry?.calories) !== null ? Math.max(0, entry.calories - previousExtra) : null));
  const baseActive = validEnergy(healthActive) ?? (entry?.baseActiveCalories === null ? null
    : validEnergy(entry?.baseActiveCalories) ?? (validEnergy(entry?.activeCalories) !== null
      ? Math.max(0, entry.activeCalories - (entry.additionalCountsAsActive ? previousExtra : 0)) : null));
  return { ...entry, baseCalories: base, baseActiveCalories: baseActive,
    additionalCalories: extra, additionalCountsAsActive: countsAsActive,
    calories: (base ?? 0) + extra,
    activeCalories: adjustedBurnedTotal(baseActive, countsAsActive ? extra : 0) };
}

export function mergeBurnedHealthReading(previous, reading) {
  if (previous?.source === 'csv') return previous;
  return setBurnedAdjustment({ ...reading, baseActiveCalories: validEnergy(reading.activeCalories),
    additionalCalories: previous?.additionalCalories ?? 0,
    additionalCountsAsActive: previous?.additionalCountsAsActive === true },
    previous?.additionalCalories ?? 0, reading.calories);
}
