// Calendar boundaries preserve the user's local day, including DST changes.
export function getExpenditureDateRanges(now = new Date()) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  return { todayStart, yesterdayStart, now: new Date(now) };
}

export function validEnergy(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function estimateDailyExpenditure(yesterdayResting, todayActive) {
  const resting = validEnergy(yesterdayResting);
  const active = validEnergy(todayActive);
  return resting !== null && active !== null
    ? Math.round(resting + active)
    : null;
}

export function deriveRestingEnergy(total, active) {
  const totalEnergy = validEnergy(total);
  const activeEnergy = validEnergy(active);
  // Inconsistent or missing records must not produce a plausible-looking estimate.
  return totalEnergy !== null && activeEnergy !== null && totalEnergy >= activeEnergy
    ? totalEnergy - activeEnergy
    : null;
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sanitizeRestingHistory(history, now = new Date()) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};
  const earliest = new Date(now);
  earliest.setDate(earliest.getDate() - 7);
  const firstKey = localDateKey(earliest), lastKey = localDateKey(now);
  return Object.fromEntries(Object.entries(history).filter(([date, value]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= firstKey && date <= lastKey && validEnergy(value) !== null
  ));
}

export function rememberRestingEnergy(history, date, value, now = new Date()) {
  const cleaned = sanitizeRestingHistory(history, now);
  if (validEnergy(value) !== null && typeof date === 'string') cleaned[date] = value;
  return sanitizeRestingHistory(cleaned, now);
}

export function resolveRestingBaseline({ manual = null, yesterday = null, history = {}, now = new Date() } = {}) {
  if (validEnergy(manual) !== null) return { calories: manual, source: 'manual' };
  if (validEnergy(yesterday) !== null) return { calories: yesterday, source: 'health' };
  const { yesterdayStart } = getExpenditureDateRanges(now);
  const cached = history?.[localDateKey(yesterdayStart)];
  if (validEnergy(cached) !== null) return { calories: cached, source: 'saved' };
  return { calories: 0, source: 'zero' };
}

// Mifflin–St Jeor, resting energy in kcal/day: https://pubmed.ncbi.nlm.nih.gov/2305711/
// Activity factors below are an indicative whole-day preview; they must not be
// added to measured active calories or saved as the resting-energy baseline.
export function calculateRestingProfile(profile) {
  const { age, height, weight, sex, activity } = profile || {};
  if (!Number.isInteger(age) || age < 18 || age > 120 || !Number.isFinite(height) || height < 100 || height > 250
    || !Number.isFinite(weight) || weight < 30 || weight > 350 || !['male', 'female'].includes(sex)
    || !['sedentary', 'moderate', 'athlete'].includes(activity)) return null;
  const resting = Math.round(10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161));
  if (resting <= 0) return null;
  const factor = { sedentary: 1.2, moderate: 1.55, athlete: 1.9 }[activity];
  return { resting, total: Math.round(resting * factor) };
}

// Garmin's daily resting budget accrues by local wall-clock minute. Keep the
// timestamp paired with the health reading so unrelated renders cannot reduce
// activity using newer time against an older total.
export function estimateGarminExpenditure(totalCalories, dailyRestingCalories, sampledAt) {
  const total = validEnergy(totalCalories);
  const resting = validEnergy(dailyRestingCalories);
  const date = new Date(sampledAt);
  if (total === null || resting === null || !Number.isFinite(date.getTime())) return null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const accruedResting = resting * minutes / 1440;
  const active = Math.max(0, total - accruedResting);
  return { active, accruedResting, estimated: Math.round(resting + active) };
}

// Only today's peak survives. Returning the existing object for an unchanged
// peak avoids repeated writes on polling, renders and failed health reads.
export function rememberDailyExpenditurePeak(previous, candidate, now = new Date()) {
  const date = localDateKey(now);
  const saved = previous?.date === date ? validEnergy(previous.calories) : null;
  const current = validEnergy(candidate);
  if (saved === null && current === null) return null;
  const calories = Math.max(saved ?? 0, current ?? 0);
  if (saved !== null && previous.calories === calories) return previous;
  return { date, calories };
}

// A newer health reading may legitimately correct the daily total downward.
// Hold activity and expenditure only while the source total stays level or
// increases; time passing alone must never make either displayed value fall.
export function rememberDailyEnergyReading(previous, candidate, now = new Date()) {
  const date = localDateKey(now);
  const prior = previous?.version === 2 && previous.date === date && validEnergy(previous.total) !== null ? previous : null;
  const total = candidate?.date === date ? validEnergy(candidate.total) : null;
  if (total === null) return prior;
  const active = validEnergy(candidate.active);
  const estimated = validEnergy(candidate.estimated);
  const calculationChanged = prior !== null && candidate.calculationKey !== undefined
    && prior.calculationKey !== candidate.calculationKey;
  const lowerTotal = prior !== null && (total < prior.total || calculationChanged);
  const next = {
    version: 2,
    calculationKey: candidate.calculationKey,
    date,
    total,
    active: lowerTotal ? active : (validEnergy(prior?.active) !== null
      ? Math.max(prior.active, active ?? 0) : active),
    estimated: lowerTotal ? estimated : (validEnergy(prior?.estimated) !== null
      ? Math.max(prior.estimated, estimated ?? 0) : estimated),
  };
  return prior && prior.calculationKey === next.calculationKey && prior.total === next.total && prior.active === next.active
    && prior.estimated === next.estimated ? prior : next;
}
