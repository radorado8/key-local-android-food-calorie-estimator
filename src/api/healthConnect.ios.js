import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

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

export async function getTodayBurnedCalories() {
  if (!(await hasTotalCaloriesPermission())) return null;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();

  const totals = await Promise.all(ENERGY_TYPES.map(async identifier => {
    const result = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
      unit: 'kcal',
      filter: { date: { startDate, endDate } },
    });
    return result.sumQuantity?.quantity ?? 0;
  }));

  const total = totals.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? Math.max(0, Math.round(total)) : null;
}

export function openHealthConnectSettingsScreen() {
  // iOS exposes Health permissions in Settings > Health > Data Access & Devices.
}
