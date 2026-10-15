import { mealTimestamp } from './latestMeal';

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Attribute each interval to its later meal, including one before the range.
// Do not merge intervals when a short interval is excluded (multiple meal items).
export function summarizeMealGaps(meals, dates, minHours = 1, maxHours = 9, monthly = false) {
  const buckets = new Map();
  const includedDates = new Set(dates.map(dateKey));
  const keyFor = date => monthly ? dateKey(date).slice(0, 7) : dateKey(date);
  for (const date of dates) {
    const key = keyFor(date);
    if (!buckets.has(key)) buckets.set(key, { key, date: new Date(date), count: 0, total: 0, average: null });
  }
  const times = (meals || []).map(mealTimestamp).filter(time => time !== null).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    const hours = (times[i] - times[i - 1]) / 3600000;
    const date = new Date(times[i]);
    const bucket = includedDates.has(dateKey(date)) ? buckets.get(keyFor(date)) : null;
    if (bucket && hours > minHours && hours < maxHours) {
      bucket.count++;
      bucket.total += hours;
    }
  }
  return [...buckets.values()].map(bucket => ({ ...bucket, average: bucket.count ? bucket.total / bucket.count : null }));
}
