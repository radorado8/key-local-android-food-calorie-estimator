const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
process.env.TZ = 'Europe/Bratislava';
function load(file, mocks = {}) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(require.resolve(file), 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  vm.runInNewContext(code, { exports, Date, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const utils = load('../src/utils/calorieExpenditure.js');
test('estimate uses full resting day plus current activity and rounds only once', () => {
  assert.equal(utils.estimateDailyExpenditure(utils.deriveRestingEnergy(2345.4, 500.2), 100.4), 1946);
  assert.equal(utils.estimateDailyExpenditure(1800, 0), 1800);
});
test('missing, negative, invalid or inconsistent energy does not invent an estimate', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, '1800']) {
    assert.equal(utils.estimateDailyExpenditure(value, 100), null);
    assert.equal(utils.estimateDailyExpenditure(1800, value), null);
  }
  assert.equal(utils.deriveRestingEnergy(100, 200), null);
  assert.equal(utils.deriveRestingEnergy(0, 0), 0);
});
test('yesterday follows local calendar boundaries across DST and year rollover', () => {
  for (const [date, hours] of [['2026-03-30T12:00:00+02:00', 23], ['2026-10-26T12:00:00+01:00', 25], ['2027-01-01T12:00:00+01:00', 24]]) {
    const range = utils.getExpenditureDateRanges(new Date(date));
    assert.equal(range.todayStart.getHours(), 0);
    assert.equal(range.yesterdayStart.getHours(), 0);
    assert.equal((range.todayStart - range.yesterdayStart) / 3600000, hours);
  }
});
function androidApi({ activePermission = true, failHistory = false, emptyHistory = false, zeroHistory = false, grantActive = false, dailyProvider = false, missingActive = false, recordedActiveZero = false } = {}) {
  const requests = [];
  let activeCalls = 0, totalCalls = 0;
  let activeGranted = activePermission;
  const hc = {
    getSdkStatus: async () => 1,
    SdkAvailabilityStatus: { SDK_AVAILABLE: 1 },
    initialize: async () => true,
    getGrantedPermissions: async () => ['TotalCaloriesBurned', ...(activeGranted ? ['ActiveCaloriesBurned'] : [])].map(recordType => ({ recordType, accessType: 'read' })),
    requestPermission: async permissions => { if (grantActive) activeGranted = true; return permissions; },
    aggregateRecord: async request => {
      requests.push(request);
      const isActive = request.recordType === 'ActiveCaloriesBurned';
      const index = isActive ? activeCalls++ : totalCalls++;
      if (isActive && (missingActive || recordedActiveZero)) return { dataOrigins: missingActive ? [] : ['test.health.provider'], ACTIVE_CALORIES_TOTAL: { inKilocalories: 0 } };
      if (dailyProvider && index === 0) {
        const fullDay = new Date(request.timeRangeFilter.endTime).getHours() === 0;
        return isActive ? { ACTIVE_CALORIES_TOTAL: { inKilocalories: fullDay ? 386 : 0 } }
          : { ENERGY_TOTAL: { inKilocalories: fullDay ? 510 : 124 } };
      }
      if (failHistory && index > 0) throw new Error('history unavailable');
      if (!isActive && index > 0 && (emptyHistory || zeroHistory)) return { dataOrigins: emptyHistory ? [] : ['test.health.provider'], ENERGY_TOTAL: { inKilocalories: 0 } };
      if (isActive && index > 0 && zeroHistory) return { dataOrigins: ['test.health.provider'], ACTIVE_CALORIES_TOTAL: { inKilocalories: 0 } };
      return isActive ? { ACTIVE_CALORIES_TOTAL: { inKilocalories: index === 0 ? 200 : 500 } }
        : { ENERGY_TOTAL: { inKilocalories: index === 0 ? 800 : 2300 } };
    },
  };
  return { api: load('../src/api/healthConnect.js', {
    'react-native': { Platform: { OS: 'android' } },
    'react-native-health-connect': hc,
    '../utils/calorieExpenditure': utils,
  }), requests };
}
test('Android reads yesterday total minus active, then adds today active', async () => {
  const { api, requests } = androidApi();
  const result = await api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.estimatedBurnedCalories, 2000);
  assert.equal(requests[2].timeRangeFilter.endTime, requests[0].timeRangeFilter.startTime);
  assert.equal(requests[2].timeRangeFilter.startTime, requests[3].timeRangeFilter.startTime);
});
test('existing Android total-only permission continues to show measured calories', async () => {
  const { api, requests } = androidApi({ activePermission: false });
  const result = await api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.estimatedBurnedCalories, null);
  assert.equal(requests.length, 1);
});
test('failure of optional Android history preserves measured calories', async () => {
  const { api } = androidApi({ failHistory: true });
  const result = await api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.estimatedBurnedCalories, null);
});
function iosApi({ missingYesterday = false, failYesterday = false, available = true } = {}) {
  const requests = [];
  let restingCalls = 0;
  const healthkit = {
    isHealthDataAvailable: async () => available,
    queryStatisticsForQuantity: async (identifier, options, request) => {
      requests.push(request);
      if (identifier.endsWith('ActiveEnergyBurned')) return { sumQuantity: { quantity: 200 } };
      if (restingCalls++ === 0) return { sumQuantity: { quantity: 600 } };
      if (failYesterday) throw new Error('history unavailable');
      return missingYesterday ? {} : { sumQuantity: { quantity: 1800 } };
    },
  };
  return { api: load('../src/api/healthConnect.ios.js', {
    '@kingstinct/react-native-healthkit': healthkit,
    '../utils/calorieExpenditure': utils,
  }), requests };
}
test('iOS reads yesterday basal energy directly and preserves current total', async () => {
  const { api, requests } = iosApi();
  const result = await api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.estimatedBurnedCalories, 2000);
  assert.equal(requests[2].filter.date.endDate.getTime(), requests[0].filter.date.startDate.getTime());
});
test('missing or failed iOS history hides only the estimate', async () => {
  for (const options of [{ missingYesterday: true }, { failYesterday: true }]) {
    const result = await iosApi(options).api.getCalorieExpenditure();
    assert.equal(result.burnedCalories, 800);
    assert.equal(result.estimatedBurnedCalories, null);
  }
});
test('unavailable HealthKit returns no values and makes no queries', async () => {
  const { api, requests } = iosApi({ available: false });
  const result = await api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, null);
  assert.equal(result.estimatedBurnedCalories, null);
  assert.equal(requests.length, 0);
});

test('a known zero resting value is a valid baseline', () => {
  assert.equal(utils.estimateDailyExpenditure(0, 0), 0);
  assert.equal(utils.estimateDailyExpenditure(0, 250), 250);
});
test('manual override, health history and saved yesterday have explicit priority, including zero', () => {
  const now = new Date('2026-09-29T12:00:00+02:00');
  const options = { now, history: { '2026-09-28': 1600 }, yesterday: 1800 };
  assert.equal(utils.resolveRestingBaseline({ ...options, manual: 0 }).source, 'manual');
  assert.equal(utils.resolveRestingBaseline({ ...options, manual: 0 }).calories, 0);
  assert.equal(utils.resolveRestingBaseline({ ...options, yesterday: 0 }).source, 'health');
  assert.equal(utils.resolveRestingBaseline({ ...options, yesterday: 0 }).calories, 0);
  assert.equal(utils.resolveRestingBaseline({ ...options, yesterday: null }).calories, 1600);
  assert.equal(utils.resolveRestingBaseline({ now }).source, 'zero');
  assert.equal(utils.resolveRestingBaseline({ now }).calories, 0);
});
test('today is saved locally and used only as yesterday after a date change and restart', () => {
  const today = new Date('2026-09-28T22:00:00+02:00');
  const saved = utils.rememberRestingEnergy({}, '2026-09-28', 1400, today);
  const hydrated = JSON.parse(JSON.stringify(saved));
  assert.equal(utils.resolveRestingBaseline({ now: today, history: hydrated }).calories, 0);
  assert.equal(utils.resolveRestingBaseline({ now: new Date('2026-09-29T07:00:00+02:00'), history: hydrated }).calories, 1400);
  assert.equal(utils.resolveRestingBaseline({ now: new Date('2026-09-30T07:00:00+02:00'), history: hydrated }).calories, 0);
});
test('cache prunes expired and invalid data, and missing reads do not erase saved calories', () => {
  const now = new Date('2026-09-29T12:00:00+02:00');
  const cached = utils.rememberRestingEnergy({ '2026-09-28': 1500, '2026-08-01': 1900, '2026-09-27': -1 }, '2026-09-29', null, now);
  assert.equal(cached['2026-09-28'], 1500);
  assert.equal(Object.keys(cached).length, 1);
});
test('profile uses Mifflin–St Jeor and activity never inflates the saved resting baseline', () => {
  const profile = { age: 35, height: 180, weight: 80, sex: 'male', activity: 'sedentary' };
  assert.equal(utils.calculateRestingProfile(profile).resting, 1755);
  assert.equal(utils.calculateRestingProfile({ ...profile, sex: 'female' }).resting, 1589);
  const moderate = utils.calculateRestingProfile({ ...profile, activity: 'moderate' });
  const athlete = utils.calculateRestingProfile({ ...profile, activity: 'athlete' });
  assert.equal(moderate.resting, 1755);
  assert.equal(athlete.resting, 1755);
  assert.ok(athlete.total > moderate.total);
  assert.equal(utils.calculateRestingProfile({ ...profile, age: 0 }), null);
  assert.equal(utils.calculateRestingProfile({ ...profile, height: NaN }), null);
  assert.equal(utils.calculateRestingProfile({ ...profile, weight: -1 }), null);
});
test('optional Android history failure still supplies today resting calories for the cache', async () => {
  const result = await androidApi({ failHistory: true }).api.getCalorieExpenditure();
  assert.equal(result.todayActiveCalories, 200);
  assert.equal(result.todayRestingCalories, 600);
  assert.equal(result.yesterdayRestingCalories, null);
});

test('Android bridge zero with no contributing total source is missing history', async () => {
  const result = await androidApi({ emptyHistory: true }).api.getCalorieExpenditure();
  assert.equal(result.yesterdayRestingCalories, null);
  assert.equal(result.burnedCalories, 800);
});
test('a recorded Android zero with a contributing source remains a valid zero', async () => {
  const result = await androidApi({ zeroHistory: true }).api.getCalorieExpenditure();
  assert.equal(result.yesterdayRestingCalories, 0);
  assert.equal(result.estimatedBurnedCalories, 200);
});


test('Android daily queries include provider records ending later today', async () => {
  const { api, requests } = androidApi();
  await api.getCalorieExpenditure();
  const start = new Date(requests[0].timeRangeFilter.startTime);
  const end = new Date(requests[0].timeRangeFilter.endTime);
  const expected = new Date(start);
  expected.setDate(expected.getDate() + 1);
  assert.equal(end.getTime(), expected.getTime());
  assert.equal(end.getHours(), 0);
  assert.equal(requests[1].timeRangeFilter.endTime, requests[0].timeRangeFilter.endTime);
});
test('upgrading total-only Android access requests activity and adds it to manual baseline', async () => {
  const { api } = androidApi({ activePermission: false, grantActive: true });
  const result = await api.getCalorieExpenditure({ requestMissingPermissions: true });
  assert.equal(result.todayActiveCalories, 200);
  assert.equal(utils.estimateDailyExpenditure(1800, result.todayActiveCalories), 2000);
  assert.equal(result.burnedCalories, 800);
});
test('declining new activity permission preserves existing total calories', async () => {
  const { api } = androidApi({ activePermission: false });
  const result = await api.getCalorieExpenditure({ requestMissingPermissions: true });
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.todayActiveCalories, null);
});

test('daily provider regression keeps 510 total and adds 386 active to manual resting', async () => {
  const result = await androidApi({ dailyProvider: true }).api.getCalorieExpenditure();
  assert.equal(result.burnedCalories, 510);
  assert.equal(result.todayActiveCalories, 386);
  assert.equal(utils.estimateDailyExpenditure(1800, result.todayActiveCalories), 2186);
});

test('missing Android active aggregate is unavailable, not measured zero or cached passive energy', async () => {
  const result = await androidApi({ missingActive: true }).api.getCalorieExpenditure();
  assert.equal(result.todayActiveCalories, null);
  assert.equal(result.todayRestingCalories, null);
  assert.equal(result.yesterdayRestingCalories, null);
  assert.equal(result.estimatedBurnedCalories, null);
  assert.equal(result.burnedCalories, 800);
});
test('recorded Android zero activity remains a valid reading', async () => {
  const result = await androidApi({ recordedActiveZero: true }).api.getCalorieExpenditure();
  assert.equal(result.todayActiveCalories, 0);
  assert.equal(result.yesterdayRestingCalories, 2300);
  assert.equal(result.estimatedBurnedCalories, 2300);
});

test('Garmin uses local midday to subtract half the resting budget', () => {
  const result = utils.estimateGarminExpenditure(1350, 2100, '2026-09-29T12:00:59+02:00');
  assert.equal(result.accruedResting, 1050);
  assert.equal(result.active, 300);
  assert.equal(result.estimated, 2400);
});
test('Garmin accrual uses whole local minutes, not UTC or seconds', () => {
  const result = utils.estimateGarminExpenditure(650, 2100, '2026-09-29T06:34:59+02:00');
  assert.equal(result.accruedResting, 2100 * 394 / 1440);
  assert.equal(result.estimated, Math.round(2100 + 650 - 2100 * 394 / 1440));
  assert.equal(utils.estimateGarminExpenditure(650, 2100, '2026-09-29T06:34:00+02:00').active, result.active);
});
test('Garmin clamps negative activity and handles midnight and invalid values', () => {
  assert.equal(utils.estimateGarminExpenditure(100, 2100, '2026-09-29T12:00:00+02:00').active, 0);
  assert.equal(utils.estimateGarminExpenditure(100, 2100, '2026-09-29T12:00:00+02:00').estimated, 2100);
  assert.equal(utils.estimateGarminExpenditure(50, 2100, '2026-09-29T00:00:00+02:00').active, 50);
  assert.equal(utils.estimateGarminExpenditure(null, 2100, '2026-09-29T12:00:00+02:00'), null);
  assert.equal(utils.estimateGarminExpenditure(500, -1, '2026-09-29T12:00:00+02:00'), null);
  assert.equal(utils.estimateGarminExpenditure(500, 2100, 'invalid'), null);
});
test('Garmin uses local clock minutes on winter-time and DST days', () => {
  for (const date of ['2026-03-29T12:00:00+02:00', '2026-10-25T12:00:00+01:00', '2026-12-29T12:00:00+01:00']) {
    assert.equal(utils.estimateGarminExpenditure(1350, 2100, date).estimated, 2400);
  }
});
test('Garmin mode reads only total energy and ignores supplied activity records', async () => {
  const { api, requests } = androidApi();
  const result = await api.getCalorieExpenditure({ garminMode: true, requestMissingPermissions: true });
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.todayActiveCalories, null);
  assert.equal(result.todayRestingCalories, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].recordType, 'TotalCaloriesBurned');
  assert.ok(Number.isFinite(new Date(result.sampledAt).getTime()));
});

test('Garmin resting budget is configurable, not fixed at 2100', () => {
  const noon = '2026-09-29T12:00:00+02:00';
  const custom = utils.estimateGarminExpenditure(1600, 2500, noon);
  assert.equal(custom.accruedResting, 1250);
  assert.equal(custom.active, 350);
  assert.equal(custom.estimated, 2850);
  assert.equal(utils.estimateGarminExpenditure(1600, 0, noon).estimated, 1600);
});
test('iOS Garmin mode forms total from HealthKit components but derives activity independently', async () => {
  const { api, requests } = iosApi();
  const result = await api.getCalorieExpenditure({ garminMode: true });
  assert.equal(result.burnedCalories, 800);
  assert.equal(result.todayActiveCalories, null);
  assert.equal(result.todayRestingCalories, null);
  assert.equal(result.yesterdayRestingCalories, null);
  assert.equal(requests.length, 2);
  assert.ok(Number.isFinite(new Date(result.sampledAt).getTime()));
  assert.equal(requests[0].filter.date.endDate.getHours(), 0);
  const derived = utils.estimateGarminExpenditure(result.burnedCalories, 1000, '2026-09-29T12:00:00+02:00');
  assert.equal(derived.active, 300);
  assert.equal(derived.estimated, 1300);
});

test('same Garmin total sampled later cannot lower the daily expenditure peak', () => {
  const now = new Date('2026-09-29T08:12:00+02:00');
  const first = utils.estimateGarminExpenditure(782, 2100, '2026-09-29T08:06:00+02:00');
  const peak = utils.rememberDailyExpenditurePeak(null, first.estimated, now);
  const later = utils.estimateGarminExpenditure(782, 2100, '2026-09-29T08:12:00+02:00');
  assert.ok(later.estimated < first.estimated);
  assert.equal(utils.rememberDailyExpenditurePeak(peak, later.estimated, now), peak);
  assert.equal(utils.rememberDailyExpenditurePeak(peak, null, now), peak);
  const refreshed = utils.estimateGarminExpenditure(850, 2100, '2026-09-29T08:12:00+02:00');
  assert.equal(utils.rememberDailyExpenditurePeak(peak, refreshed.estimated, now).calories, refreshed.estimated);
});
test('daily peak survives restart and resets on the next local calendar day', () => {
  const now = new Date('2026-09-29T23:59:00+02:00');
  const saved = JSON.parse(JSON.stringify(utils.rememberDailyExpenditurePeak(null, 2600, now)));
  assert.equal(utils.rememberDailyExpenditurePeak(saved, 2400, now).calories, 2600);
  const tomorrow = new Date('2026-09-30T00:00:00+02:00');
  assert.equal(utils.rememberDailyExpenditurePeak(saved, null, tomorrow), null);
  assert.equal(utils.rememberDailyExpenditurePeak(saved, 2100, tomorrow).calories, 2100);
});
test('daily peak validates saved values and retains a known zero', () => {
  const now = new Date('2026-09-29T12:00:00+02:00');
  assert.equal(utils.rememberDailyExpenditurePeak({ date: '2026-09-29', calories: -1 }, null, now), null);
  assert.equal(utils.rememberDailyExpenditurePeak(null, NaN, now), null);
  assert.equal(utils.rememberDailyExpenditurePeak(null, 0, now).calories, 0);
});

test('active calorie peak does not fall during delayed Garmin sync and rises on new activity', () => {
  const now = new Date('2026-09-29T08:12:00+02:00');
  const first = utils.estimateGarminExpenditure(782, 2100, '2026-09-29T08:06:00+02:00');
  const peak = utils.rememberDailyExpenditurePeak(null, first.active, now);
  const delayed = utils.estimateGarminExpenditure(782, 2100, '2026-09-29T08:12:00+02:00');
  const held = utils.rememberDailyExpenditurePeak(peak, delayed.active, now);
  assert.equal(held.calories, first.active);
  assert.equal(utils.estimateDailyExpenditure(2100, held.calories), first.estimated);
  const synced = utils.estimateGarminExpenditure(850, 2100, '2026-09-29T08:12:00+02:00');
  assert.equal(utils.rememberDailyExpenditurePeak(held, synced.active, now).calories, synced.active);
});
test('active calorie peak persists through missing readings and restart, then resets next day', () => {
  const now = new Date('2026-09-29T23:59:00+02:00');
  const saved = JSON.parse(JSON.stringify(utils.rememberDailyExpenditurePeak(null, 273.5, now)));
  assert.equal(utils.rememberDailyExpenditurePeak(saved, null, now).calories, 273.5);
  assert.equal(utils.rememberDailyExpenditurePeak(saved, 0, now).calories, 273.5);
  assert.equal(utils.rememberDailyExpenditurePeak(saved, 0, new Date('2026-09-30T00:00:00+02:00')).calories, 0);
});

test('unchanged or higher source total cannot lower active calories or daily expenditure', () => {
  const at = new Date('2026-09-29T08:12:00+02:00');
  const first = utils.rememberDailyEnergyReading(null, { date: '2026-09-29', total: 782, active: 75, estimated: 2175 }, at);
  const delayed = utils.rememberDailyEnergyReading(first, { date: '2026-09-29', total: 782, active: 65, estimated: 2165 }, at);
  assert.equal(delayed, first);
  const higherTotal = utils.rememberDailyEnergyReading(delayed, { date: '2026-09-29', total: 790, active: 70, estimated: 2170 }, at);
  assert.equal(higherTotal.active, 75);
  assert.equal(higherTotal.estimated, 2175);
  assert.equal(higherTotal.total, 790);
});
test('lower source total permits both active calories and expenditure to decrease', () => {
  const at = new Date('2026-09-29T08:12:00+02:00');
  const first = utils.rememberDailyEnergyReading(null, { date: '2026-09-29', total: 782.4, active: 75, estimated: 2175 }, at);
  const corrected = utils.rememberDailyEnergyReading(first, { date: '2026-09-29', total: 782.1, active: 64, estimated: 2164 }, at);
  assert.equal(corrected.active, 64);
  assert.equal(corrected.estimated, 2164);
  assert.equal(corrected.total, 782.1);
  const synced = utils.rememberDailyEnergyReading(corrected, { date: '2026-09-29', total: 850, active: 117, estimated: 2217 }, at);
  assert.equal(synced.active, 117);
  assert.equal(synced.estimated, 2217);
});
test('persisted source reading survives restart, missing data, and local midnight', () => {
  const at = new Date('2026-09-29T23:59:00+02:00');
  const saved = JSON.parse(JSON.stringify(utils.rememberDailyEnergyReading(null, { date: '2026-09-29', total: 2500, active: 400, estimated: 2500 }, at)));
  assert.equal(utils.rememberDailyEnergyReading(saved, null, at), saved);
  assert.equal(utils.rememberDailyEnergyReading(saved, { date: '2026-09-29', total: 2500, active: null, estimated: 2100 }, at).active, 400);
  const tomorrow = new Date('2026-09-30T00:00:00+02:00');
  assert.equal(utils.rememberDailyEnergyReading(saved, null, tomorrow), null);
  assert.equal(utils.rememberDailyEnergyReading(saved, { date: '2026-09-30', total: 20, active: 0, estimated: 2100 }, tomorrow).active, 0);
});

test('upgrade discards old readings that lack a comparable source total version', () => {
  const now = new Date('2026-09-29T15:00:00+02:00');
  const old = { date: '2026-09-29', total: 1500, active: 600, estimated: 2700 };
  assert.equal(utils.rememberDailyEnergyReading(old, null, now), null);
  const current = utils.rememberDailyEnergyReading(old, { date: '2026-09-29', total: 1200, active: 200, estimated: 2300 }, now);
  assert.equal(current.active, 200);
  assert.equal(current.estimated, 2300);
  assert.equal(current.version, 2);
});

 test('changing resting budget or calculation mode permits recalculation at unchanged health total', () => {
  const now = new Date('2026-09-29T12:00:00+02:00');
  const date = utils.localDateKey(now);
  const first = utils.rememberDailyEnergyReading(null, { date, total: 1200, active: 150, estimated: 2250, calculationKey: 'garmin:2100' }, now);
  const changed = utils.rememberDailyEnergyReading(first, { date, total: 1200, active: 0, estimated: 2500, calculationKey: 'garmin:2500' }, now);
  assert.equal(changed.active, 0);
  assert.equal(changed.estimated, 2500);
  const lower = utils.rememberDailyEnergyReading(changed, { date, total: 1200, active: 0, estimated: 1900, calculationKey: 'health:1900' }, now);
  assert.equal(lower.estimated, 1900);
  assert.equal(utils.estimateDailyExpenditure(1900, lower.active), 1900);
});

const burnedHistory = load('../src/utils/burnedHistory.js', { './calorieExpenditure': utils });
test('burned averages exclude unavailable days but include measured zero', () => {
  const result = burnedHistory.summarizeBurnedDays([{ burned: null }, { burned: 0 }, { burned: 2400 }]);
  assert.equal(result.average, 1200);
  assert.equal(result.lowest, 0);
  assert.equal(result.highest, 2400);
  assert.equal(burnedHistory.summarizeBurnedDays([{ burned: null }]).average, null);
});
test('cached historical days skip reads while yesterday is finalized after midnight', () => {
  const now = new Date('2026-10-04T12:00:00+02:00');
  const history = {};
  for (const date of burnedHistory.burnedHistoryDates({}, now)) history[date] = { calories: 2300, checkedOn: '2026-10-04' };
  assert.equal(burnedHistory.burnedHistoryDates(history, now).length, 0);
  history['2026-10-03'].checkedOn = '2026-10-03';
  assert.equal(burnedHistory.burnedHistoryDates(history, now).join(','), '2026-10-03');
  assert.equal(burnedHistory.sanitizeBurnedHistory({ bad: { calories: 100 }, '2026-10-03': { calories: -1 } })['2026-10-03'], undefined);
});
