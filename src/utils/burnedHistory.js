import { mergeBurnedHealthReading } from './additionalBurnedCalories';
import { localDateKey, validEnergy } from './calorieExpenditure';

export function sanitizeBurnedHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([date, entry]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) && validEnergy(entry?.calories) !== null));
}

export function burnedHistoryDates(history, now = new Date()) {
  const today = localDateKey(now);
  const dates = [];
  for (let i = 29; i >= 1; i--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = localDateKey(day);
    // Reconcile yesterday once after midnight; older cached days need no reads.
    if (history[key]?.source !== 'csv' && (!history[key] || (i === 1 && history[key].checkedOn !== today))) dates.push(key);
  }
  return dates;
}

export function summarizeBurnedDays(days) {
  const values = days.map(day => day.burned).filter(value => validEnergy(value) !== null);
  if (!values.length) return { total: null, average: null, highest: null, lowest: null };
  const total = values.reduce((sum, value) => sum + value, 0);
  return { total: Math.round(total), average: Math.round(total / values.length),
    highest: Math.round(Math.max(...values)), lowest: Math.round(Math.min(...values)) };
}

// Calendar dates, not elapsed 24-hour periods (DST-safe).
export function recentBurnedDates(count = 1, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - index - 1);
    return localDateKey(day);
  });
}

export function reconcileBurnedHistory(history, readings) {
  const next = { ...history };
  for (const [date, reading] of Object.entries(readings)) {
    if (validEnergy(reading?.calories) === null) continue;
    const previous = history[date];
    const base = validEnergy(previous?.baseCalories)
      ?? (validEnergy(previous?.calories) === null ? null
        : Math.max(0, previous.calories - (validEnergy(previous.additionalCalories) ?? 0)));
    if (base !== null && reading.calories <= base) continue;
    // An explicit historical refresh may also improve imported burned data.
    const merged = mergeBurnedHealthReading(previous ? { ...previous, source: undefined } : previous,
      { ...previous, ...reading,
        activeCalories: reading.activeCalories ?? previous?.baseActiveCalories ?? (validEnergy(previous?.activeCalories) === null ? null : Math.max(0, previous.activeCalories - (previous.additionalCountsAsActive ? previous.additionalCalories ?? 0 : 0))) });
    next[date] = merged;
  }
  return next;
}
