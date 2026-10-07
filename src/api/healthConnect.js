import { Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { deriveRestingEnergy, estimateDailyExpenditure, getExpenditureDateRanges, localDateKey, validEnergy } from '../utils/calorieExpenditure';

const ACTIVE_CALORIES_PERMISSION = { accessType: 'read', recordType: 'ActiveCaloriesBurned' };

const TOTAL_CALORIES_PERMISSION = {
  accessType: 'read',
  recordType: 'TotalCaloriesBurned',
};

export async function getHealthConnectAvailability() {
  if (Platform.OS !== 'android') return 'unsupported';

  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update-required';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function connectHealthConnect() {
  const availability = await getHealthConnectAvailability();
  if (availability !== 'available') return { connected: false, availability };

  const initialized = await initialize();
  if (!initialized) return { connected: false, availability: 'unavailable' };

  const permissions = await requestPermission([TOTAL_CALORIES_PERMISSION, ACTIVE_CALORIES_PERMISSION]);
  const connected = permissions.some(permission =>
    permission.accessType === 'read' && permission.recordType === 'TotalCaloriesBurned'
  );
  return { connected, availability };
}

export async function hasTotalCaloriesPermission() {
  if (await getHealthConnectAvailability() !== 'available') return false;
  if (!(await initialize())) return false;
  const permissions = await getGrantedPermissions();
  return permissions.some(permission =>
    permission.accessType === 'read' && permission.recordType === 'TotalCaloriesBurned'
  );
}

async function readEnergy(recordType, start, end) {
  const result = await aggregateRecord({
    recordType,
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  const metric = recordType === 'TotalCaloriesBurned' ? 'ENERGY_TOTAL' : 'ACTIVE_CALORIES_TOTAL';
  const energy = validEnergy(result?.[metric]?.inKilocalories);
  // The bridge returns 0 for missing aggregates of either calorie type.
  // No contributing source means missing data, not measured inactivity.
  if (energy === 0 && Array.isArray(result?.dataOrigins) && result.dataOrigins.length === 0) return null;
  return energy;
}

export async function getCalorieExpenditure({ requestMissingPermissions = false, garminMode = false } = {}) {
  const { todayStart, yesterdayStart, now } = getExpenditureDateRanges();
  const empty = { date: localDateKey(now), burnedCalories: null, estimatedBurnedCalories: null,
    todayActiveCalories: null, todayRestingCalories: null, yesterdayRestingCalories: null };
  if (await getHealthConnectAvailability() !== 'available' || !(await initialize())) return empty;
  let permissions = await getGrantedPermissions();
  if (requestMissingPermissions && !garminMode && !permissions.some(p => p.accessType === 'read' && p.recordType === 'ActiveCaloriesBurned')) {
    try {
      await requestPermission([TOTAL_CALORIES_PERMISSION, ACTIVE_CALORIES_PERMISSION]);
      permissions = await getGrantedPermissions();
    } catch {
      // Keep existing total-calorie access if the additional permission is declined.
    }
  }
  const canRead = type => permissions.some(p => p.accessType === 'read' && p.recordType === type);
  if (!canRead('TotalCaloriesBurned')) return empty;
  const activeAllowed = !garminMode && canRead('ActiveCaloriesBurned');
  // Providers can publish a daily record ending later today. Preserve the
  // full local-day query used before expenditure estimates were introduced.
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const results = await Promise.allSettled([
    readEnergy('TotalCaloriesBurned', todayStart, todayEnd),
    activeAllowed ? readEnergy('ActiveCaloriesBurned', todayStart, todayEnd) : Promise.resolve(null),
    activeAllowed ? readEnergy('TotalCaloriesBurned', yesterdayStart, todayStart) : Promise.resolve(null),
    activeAllowed ? readEnergy('ActiveCaloriesBurned', yesterdayStart, todayStart) : Promise.resolve(null),
  ]);
  const [totalToday, activeToday, totalYesterday, activeYesterday] = results.map(r => r.status === 'fulfilled' ? r.value : null);
  const yesterdayResting = deriveRestingEnergy(totalYesterday, activeYesterday);
  return {
    ...empty,
    sampledAt: new Date().toISOString(),
    rawBurnedCalories: totalToday,
    burnedCalories: totalToday === null ? null : Math.round(totalToday),
    todayActiveCalories: activeToday,
    todayRestingCalories: deriveRestingEnergy(totalToday, activeToday),
    yesterdayRestingCalories: yesterdayResting,
    estimatedBurnedCalories: estimateDailyExpenditure(yesterdayResting, activeToday),
  };
}

export async function getTodayBurnedCalories() {
  return (await getCalorieExpenditure()).burnedCalories;
}

export function openHealthConnectSettingsScreen() {
  if (Platform.OS === 'android') openHealthConnectSettings();
}

// Local calendar boundaries also handle 23/25-hour daylight-saving days.
export async function getHistoricalBurnedCalories(dates) {
  if (!(await hasTotalCaloriesPermission())) return {};
  const values = {};
  for (let offset = 0; offset < dates.length; offset += 4) {
    await Promise.all(dates.slice(offset, offset + 4).map(async key => {
      const [year, month, day] = key.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      try {
        const calories = await readEnergy('TotalCaloriesBurned', start, end);
        if (calories !== null) values[key] = { calories: Math.round(calories), checkedOn: localDateKey() };
      } catch { /* Retain cached data when a historical read fails. */ }
    }));
  }
  return values;
}
