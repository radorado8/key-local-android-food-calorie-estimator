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

  const permissions = await requestPermission([TOTAL_CALORIES_PERMISSION]);
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

export async function getTodayBurnedCalories() {
  if (!(await hasTotalCaloriesPermission())) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await aggregateRecord({
    recordType: 'TotalCaloriesBurned',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });

  const rawKilocalories = result?.ENERGY_TOTAL?.inKilocalories;
  const kilocalories = Number(rawKilocalories);
  return rawKilocalories != null && Number.isFinite(kilocalories)
    ? Math.max(0, Math.round(kilocalories))
    : null;
}

export function openHealthConnectSettingsScreen() {
  if (Platform.OS === 'android') openHealthConnectSettings();
}
