import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { estimateDailyExpenditure, getExpenditureDateRanges, localDateKey, validEnergy } from '../utils/calorieExpenditure';

const ENERGY_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
];

export async function getHealthConnectAvailability() {
  try {
    return (await isHealthDataAvailable()) ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function connectHealthConnect() {
  const availability = await getHealthConnectAvailability();
  if (availability !== 'available') return { connected: false, availability };

  try {
    // HealthKit deliberately does not expose whether read access was granted.
    // This confirms that the authorization request completed, not the user's choice.
    await requestAuthorization({ toRead: ENERGY_TYPES });
    return { connected: true, availability };
  } catch {
    return { connected: false, availability: 'unavailable' };
  }
}

export async function hasTotalCaloriesPermission() {
  // HealthKit hides read-permission status. The app only calls this while its
  // own “Apple Health” setting is enabled, after requesting authorization.
  return (await getHealthConnectAvailability()) === 'available';
}

async function readEnergy(identifier, startDate, endDate) {
  const result = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
    unit: 'kcal', filter: { date: { startDate, endDate } },
  });
  return validEnergy(result.sumQuantity?.quantity);
}

export async function getCalorieExpenditure({ garminMode = false } = {}) {
  const { todayStart, yesterdayStart, now } = getExpenditureDateRanges();
  const empty = { date: localDateKey(now), burnedCalories: null, estimatedBurnedCalories: null,
    todayActiveCalories: null, todayRestingCalories: null, yesterdayRestingCalories: null };
  if (!(await hasTotalCaloriesPermission())) return empty;
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const end = garminMode ? todayEnd : now;
  // HealthKit has no separate total-energy quantity. Read both components
  // only to form the measured total; Garmin mode derives activity from that
  // total and the configured resting budget, ignoring the active component.
  const results = await Promise.allSettled([
    readEnergy(ENERGY_TYPES[0], todayStart, end),
    readEnergy(ENERGY_TYPES[1], todayStart, end),
    garminMode ? Promise.resolve(null) : readEnergy(ENERGY_TYPES[1], yesterdayStart, todayStart),
  ]);
  const [activeToday, restingToday, yesterdayResting] = results.map(r => r.status === 'fulfilled' ? r.value : null);
  return {
    ...empty,
    sampledAt: new Date().toISOString(),
    rawBurnedCalories: activeToday === null && restingToday === null
      ? null : (activeToday ?? 0) + (restingToday ?? 0),
    burnedCalories: activeToday === null && restingToday === null
      ? null : Math.round((activeToday ?? 0) + (restingToday ?? 0)),
    todayActiveCalories: garminMode ? null : activeToday,
    todayRestingCalories: garminMode ? null : restingToday,
    yesterdayRestingCalories: yesterdayResting,
    estimatedBurnedCalories: garminMode ? null : estimateDailyExpenditure(yesterdayResting, activeToday),
  };
}

export async function getTodayBurnedCalories() {
  return (await getCalorieExpenditure()).burnedCalories;
}

export function openHealthConnectSettingsScreen() {
  // iOS exposes Health permissions in Settings > Health > Data Access & Devices.
}

export async function getHistoricalBurnedCalories() { return {}; }
