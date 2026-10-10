import { parseCsvRow, escapeCsvField } from './csv';

function energy(value, optional = false) {
  if (String(value ?? '').trim() === '') {
    if (optional) return null;
    throw new Error('Missing total calories');
  }
  const number = Number(String(value).trim());
  if (!Number.isFinite(number) || number < 0) throw new Error('Invalid calories');
  return number;
}

export function parseBurnedCaloriesCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const header = parseCsvRow(lines[0] || '').map(value => value.trim());
  const columns = ['datum', 'celkove_kcal', 'aktivne_kcal', 'pokojove_kcal'].map(name => header.indexOf(name));
  if (columns.some(index => index < 0) || lines.length < 2) throw new Error('Invalid CSV header');
  const values = {};
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const row = parseCsvRow(line);
    if (row.length !== header.length) throw new Error('Invalid CSV row');
    const key = row[columns[0]]?.trim();
    const date = new Date(`${key}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new Error('Invalid date');
    const activeCalories = energy(row[columns[2]], true);
    const restingCalories = energy(row[columns[3]], true);
    if (!String(row[columns[1]] ?? '').trim()) { skipped++; continue; }
    values[key] = { calories: energy(row[columns[1]]), activeCalories, restingCalories, source: 'csv' };
  }
  if (!Object.keys(values).length) throw new Error('No calorie data');
  return { values, skipped };
}

export function exportBurnedCaloriesCsv(history) {
  const rows = [['datum', 'celkove_kcal', 'aktivne_kcal', 'pokojove_kcal']];
  for (const [date, entry] of Object.entries(history).sort(([a], [b]) => a.localeCompare(b))) {
    rows.push([date, entry.calories, entry.activeCalories ?? '', entry.restingCalories ?? '']);
  }
  return '\uFEFF' + rows.map(row => row.map(escapeCsvField).join(',')).join('\n') + '\n';
}

export function aggregateAnalyticsMonths(days, language) {
  const months = new Map();
  for (const day of days) {
    const key = day.key.slice(0, 7);
    if (!months.has(key)) months.set(key, { key, date: day.date, label: day.date.toLocaleDateString(language, { month: 'short' }), calories: 0, burned: null, isToday: false });
    const month = months.get(key);
    month.calories += day.calories;
    if (day.burned !== null) month.burned = (month.burned ?? 0) + day.burned;
    month.isToday ||= day.isToday;
  }
  return [...months.values()];
}
