const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/utils/mealTypes.js'), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
vm.runInNewContext(code, { exports: exportsObject });
const { mealTypeAt, DEFAULT_MEAL_STARTS, validMealStarts, parseMealStart, formatMealStart } = exportsObject;
const at = (hour, minute = 0, starts) => mealTypeAt(new Date(2026, 9, 15, hour, minute), starts).id;
test('default types preserve history boundaries and correctly wrap midnight', () => {
  assert.equal(at(0, 59), 'snack3'); assert.equal(at(1), 'breakfast');
  assert.equal(at(9, 59), 'breakfast'); assert.equal(at(10), 'snack1');
  assert.equal(at(11), 'lunch'); assert.equal(at(14), 'snack2');
  assert.equal(at(16), 'dinner'); assert.equal(at(22), 'snack3');
});
test('minute-level custom times have complete coverage and survive JSON settings restoration', () => {
  const starts = JSON.parse(JSON.stringify({ ...DEFAULT_MEAL_STARTS, breakfast: 330, dinner: 1020 }));
  assert.equal(validMealStarts(starts), true);
  assert.equal(at(5, 29, starts), 'snack3'); assert.equal(at(5, 30, starts), 'breakfast');
  assert.equal(at(16, 59, starts), 'snack2'); assert.equal(at(17, 0, starts), 'dinner');
  const counts = {};
  for (let m = 0; m < 1440; m++) { const id = at(Math.floor(m / 60), m % 60, starts); counts[id] = (counts[id] || 0) + 1; }
  assert.equal(Object.keys(counts).length, 6);
  assert.equal(counts.snack3, 450);
});
test('invalid input and overlapping or reversed intervals are rejected', () => {
  for (const text of ['24:00', '12:60', 'abc', '', '1:2', '-1:00']) assert.equal(parseMealStart(text), null);
  assert.equal(formatMealStart(parseMealStart('01:45')), '01:45');
  for (const value of [null, {}, { ...DEFAULT_MEAL_STARTS, breakfast: 600 }, { ...DEFAULT_MEAL_STARTS, snack1: 900 }, { ...DEFAULT_MEAL_STARTS, snack3: 1440 }, { ...DEFAULT_MEAL_STARTS, breakfast: null }]) assert.equal(validMealStarts(value), false);
});
