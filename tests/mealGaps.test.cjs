const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function load(file) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(require.resolve(file), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, require: () => load('../src/utils/latestMeal.js') });
  return exports;
}
const { summarizeMealGaps } = load('../src/utils/mealGaps.js');
const meal = time => ({ timestamp: `2026-10-13T${time}:00` });
const dates = [new Date(2026, 9, 13)];
test('strict limits exclude short items, exact boundaries and overnight breaks without modifying data', () => {
  const meals = [meal('15:00'), meal('06:00'), meal('07:00'), meal('07:30'), meal('10:30'), { timestamp: 'invalid' }];
  const day = summarizeMealGaps(meals, dates)[0];
  assert.equal(day.count, 2);
  assert.equal(day.average, 3.75);
  assert.equal(meals[0].timestamp, '2026-10-13T15:00:00');
  assert.equal(summarizeMealGaps([meal('06:00'), meal('15:00')], dates)[0].count, 0);
});
test('includes previous-day meal, excludes later dates even in monthly aggregation', () => {
  const meals = [{ timestamp: '2026-10-12T23:00:00' }, meal('02:00'), { timestamp: '2026-10-14T02:00:00' }, { timestamp: '2026-10-14T05:00:00' }];
  const result = summarizeMealGaps(meals, dates, 1, 9, true);
  assert.equal(result[0].average, 3);
  assert.equal(result[0].count, 1);
});
test('empty days are missing values, monthly average weights intervals rather than days', () => {
  const meals = [meal('06:00'), meal('08:00'), meal('12:00'), { timestamp: '2026-10-14T06:00:00' }, { timestamp: '2026-10-14T12:00:00' }];
  const period = [...dates, new Date(2026, 9, 14), new Date(2026, 9, 15)];
  assert.equal(summarizeMealGaps(meals, period)[2].average, null);
  assert.equal(summarizeMealGaps(meals, period, 1, 9, true)[0].average, 4);
  assert.equal(summarizeMealGaps(meals, period, 4, 7, true)[0].average, 6);
});
