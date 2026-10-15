const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, require: id => load(path.resolve(path.dirname(file), id + '.js')) });
  return exports;
}
const { additionalBurnedForDay, adjustedBurnedTotal, setBurnedAdjustment, mergeBurnedHealthReading } = load('src/utils/additionalBurnedCalories.js');
const { sanitizeBurnedHistory, summarizeBurnedDays } = load('src/utils/burnedHistory.js');
test('replacing and clearing the daily supplement never double counts', () => {
  let entry = setBurnedAdjustment({ calories: 500, activeCalories: 100 }, 200);
  assert.equal(entry.calories, 700);
  entry = setBurnedAdjustment(entry, 200); assert.equal(entry.calories, 700);
  entry = setBurnedAdjustment(entry, 50); assert.equal(entry.calories, 550);
  entry = setBurnedAdjustment(entry, 0); assert.equal(entry.calories, 500);
  assert.equal(entry.activeCalories, 100);
});
test('live refresh and yesterday reconciliation retain the supplement exactly once', () => {
  const previous = setBurnedAdjustment({ calories: 500 }, 200);
  const live = mergeBurnedHealthReading(previous, { calories: 600, activeCalories: 150 });
  assert.equal(live.calories, 800);
  const reconciled = mergeBurnedHealthReading(live, { calories: 2500, activeCalories: 500, checkedOn: '2026-10-15' });
  assert.equal(reconciled.calories, 2700);
  assert.equal(reconciled.additionalCalories, 200);
  assert.equal(reconciled.activeCalories, 500);
});
test('local date rollover shows zero while previous day remains in analytics and backup', () => {
  const history = { '2026-10-14': setBurnedAdjustment({ calories: 2500 }, 200) };
  const restored = sanitizeBurnedHistory(JSON.parse(JSON.stringify(history)));
  assert.equal(additionalBurnedForDay(restored, '2026-10-14'), 200);
  assert.equal(additionalBurnedForDay(restored, '2026-10-15'), 0);
  assert.equal(summarizeBurnedDays([{ burned: restored['2026-10-14'].calories }]).total, 2700);
});
test('supplement can be saved before a Health reading arrives without inventing measured calories', () => {
  let entry = setBurnedAdjustment(undefined, 200);
  assert.equal(entry.baseCalories, null);
  assert.equal(entry.calories, 200);
  entry = setBurnedAdjustment(entry, 100); assert.equal(entry.calories, 100);
  entry = mergeBurnedHealthReading(entry, { calories: 500 }); assert.equal(entry.calories, 600);
  assert.equal(adjustedBurnedTotal(null, 0), null);
  assert.equal(adjustedBurnedTotal(null, 100), 100);
  assert.equal(adjustedBurnedTotal(0, 100), 100);
});
test('CSV imports preserve their totals against Health and allow replacing the supplement', () => {
  const imported = { source: 'csv', calories: 2500 };
  const adjusted = setBurnedAdjustment(imported, 100);
  assert.equal(mergeBurnedHealthReading(adjusted, { calories: 2300 }), adjusted);
  assert.equal(setBurnedAdjustment(adjusted, 50).calories, 2550);
});

test('active target adds to both totals once and can be changed back or cleared', () => {
  const base = { calories: 500, activeCalories: 100 };
  let entry = setBurnedAdjustment(base, 200, null, true);
  assert.equal(entry.calories, 700);
  assert.equal(entry.activeCalories, 300);
  entry = setBurnedAdjustment(entry, 200, null, true);
  assert.equal(entry.activeCalories, 300);
  entry = setBurnedAdjustment(entry, 200, null, false);
  assert.equal(entry.activeCalories, 100);
  assert.equal(entry.calories, 700);
  entry = setBurnedAdjustment(entry, 50, null, true);
  assert.equal(entry.activeCalories, 150);
  entry = setBurnedAdjustment(entry, 0, null, true);
  assert.equal(entry.activeCalories, 100);
  assert.equal(entry.calories, 500);
});
test('active target survives new Health data, lower readings and JSON restore', () => {
  let entry = setBurnedAdjustment({ calories: 500, activeCalories: 100 }, 200, null, true);
  entry = mergeBurnedHealthReading(entry, { calories: 700, activeCalories: 250 });
  assert.equal(entry.calories, 900);
  assert.equal(entry.activeCalories, 450);
  entry = mergeBurnedHealthReading(entry, { calories: 600, activeCalories: 150 });
  assert.equal(entry.calories, 800);
  assert.equal(entry.activeCalories, 350);
  const restored = JSON.parse(JSON.stringify(entry));
  assert.equal(setBurnedAdjustment(restored, 100, null, false).activeCalories, 150);
  assert.equal(setBurnedAdjustment(restored, 100, null, true).activeCalories, 250);
});
test('active target remains usable when Health has no active record', () => {
  let entry = setBurnedAdjustment(undefined, 200, null, true);
  assert.equal(entry.activeCalories, 200);
  entry = mergeBurnedHealthReading(entry, { calories: 700, activeCalories: null });
  assert.equal(entry.activeCalories, 200);
  assert.equal(entry.calories, 900);
  entry = setBurnedAdjustment(entry, 200, null, false);
  assert.equal(entry.activeCalories, null);
});
