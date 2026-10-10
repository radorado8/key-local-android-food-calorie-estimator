const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const babel = require('@babel/core');
function load(file) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, Date, require: name => load(path.resolve(path.dirname(file), name + '.js')) });
  return exports;
}
const csv = load('src/utils/burnedCaloriesCsv.js');
const period = load('src/utils/analyticsPeriod.js');
const header = 'datum,celkove_kcal,aktivne_kcal,pokojove_kcal\n';
test('Garmin values, zero and decimals survive a backup round trip', () => {
  const { values } = csv.parseBurnedCaloriesCsv(header + '2026-01-01,3323.5,1186.5,2137\n2026-01-02,0,0,0');
  const restored = csv.parseBurnedCaloriesCsv(csv.exportBurnedCaloriesCsv(values)).values;
  assert.equal(JSON.stringify(restored), JSON.stringify(values));
  assert.equal(values['2026-01-02'].calories, 0);
});
test('import rejects wrong columns, negative energy, invalid dates and incomplete rows', () => {
  for (const data of ['name,calories\na,2', header + '2026-02-30,20,0,20', header + '2026-01-01,-1,0,0', header + '2026-01-01,NaN,0,0', header + '2026-01-01,20']) assert.throws(() => csv.parseBurnedCaloriesCsv(data));
});
test('unknown values remain missing instead of being replaced by zero', () => {
  const result = csv.parseBurnedCaloriesCsv(header + '2026-01-01,,,\n2026-01-02,2100,,');
  assert.equal(result.skipped, 1); assert.equal(result.values['2026-01-02'].activeCalories, null);
});
test('rolling year covers exactly twelve months and cannot navigate into older imported data', () => {
  const range = period.analyticsPeriod('year', 100, new Date(2026, 9, 10));
  assert.equal(range.start.getFullYear(), 2025); assert.equal(range.start.getMonth(), 10);
  assert.equal(range.end.getDate(), 10); assert.equal(period.analyticsMaxOffset('year', new Date(2020, 0, 1)), 0);
  const days = range.dates.map(date => ({ key: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, date, calories: 100, burned: 200, isToday: false }));
  const months = csv.aggregateAnalyticsMonths(days, 'en');
  assert.equal(months.length, 12); assert.equal(months.at(-1).calories, 1000); assert.equal(months.at(-1).burned, 2000);
  assert.equal(months.reduce((sum, month) => sum + month.calories, 0), days.length * 100);
});
test('merging imported dates preserves unrelated historical days', () => {
  const existing = { '2025-12-31': { calories: 1800 }, '2026-01-01': { calories: 2000 } };
  const result = { ...existing, ...csv.parseBurnedCaloriesCsv(header + '2026-01-01,3000,900,2100').values };
  assert.equal(result['2025-12-31'].calories, 1800); assert.equal(result['2026-01-01'].calories, 3000);
});
test('meal CSV backup restores meals and energy separately, including energy-only dates', async () => {
  const source = fs.readFileSync('src/screens/SettingsScreen.js', 'utf8');
  const csvUtils = load('src/utils/csv.js');
  let content;
  let meals;
  let energy;
  const context = {
    ...csvUtils, ...csv, Date, console,
    t: {}, setExporting() {}, setImporting() {},
    burnedCaloriesHistory: { '2026-01-02': { calories: 2100, activeCalories: 0, restingCalories: 2100 } },
    getAllMeals: async () => [{ name: 'Apple, fresh', calories: 80, protein: 1, carbs: 20, fat: 0, weight_g: 150, timestamp: '2026-01-01T12:00:00Z' }],
    importMeals: async value => { meals = value; return value.length; },
    importBurnedCalories: value => { energy = value; },
    FileSystem: { documentDirectory: '/tmp/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: async (_, value) => { content = value; }, readAsStringAsync: async () => content },
    Sharing: { isAvailableAsync: async () => false },
    DocumentPicker: { getDocumentAsync: async () => ({ assets: [{ uri: '/tmp/backup' }] }) },
    Alert: { alert() {} }, getFriendlyError: () => ({}),
  };
  const exportBody = source.match(/const handleExport = async \(\) => \{([\s\S]*?)\n  };/)[1];
  const importBody = source.match(/const handleImport = async \(\) => \{([\s\S]*?)\n  };/)[1];
  await vm.runInNewContext('(async () => {' + exportBody + '})()', context);
  await vm.runInNewContext('(async () => {' + importBody + '})()', context);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].name, 'Apple, fresh');
  assert.equal(meals[0].calories, 80);
  assert.equal(energy['2026-01-02'].calories, 2100);
  assert.equal(energy['2026-01-02'].activeCalories, 0);
  content = csv.exportBurnedCaloriesCsv(context.burnedCaloriesHistory);
  meals = undefined;
  await vm.runInNewContext('(async () => {' + importBody + '})()', context);
  assert.equal(meals, undefined);
  assert.equal(energy['2026-01-02'].calories, 2100);
});
