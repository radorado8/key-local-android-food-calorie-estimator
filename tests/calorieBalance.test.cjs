const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
function load(file) {
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, Date, require: name => load(path.resolve(path.dirname(file), name + '.js')) });
  return exports;
}
const { summarizeCalorieBalance } = load('src/utils/burnedHistory.js');
test('morning with no meals cannot turn a negative total into a positive daily average', () => {
  const result = summarizeCalorieBalance([
    ...Array.from({ length: 6 }, () => ({ calories: 2100, burned: 2000 })),
    { calories: 0, burned: 1000 },
  ]);
  assert.equal(result.totalDifference, -400);
  assert.equal(result.averageDifference, -57);
  assert.equal(result.intakeAverage, 1800);
  assert.equal(result.burnedAverage, 1857);
});
test('empty future calendar days do not dilute averages; known zero expenditure counts', () => {
  const result = summarizeCalorieBalance([{ calories: 200, burned: 100 }, { calories: 0, burned: 0 }, { calories: 0, burned: null }]);
  assert.equal(result.intakeAverage, 100);
  assert.equal(result.burnedAverage, 50);
  assert.equal(result.averageDifference, 50);
});
test('no Health data retains the existing intake-only presentation', () => {
  assert.equal(summarizeCalorieBalance([{ calories: 200, burned: null }]), null);
  assert.equal(summarizeCalorieBalance([]), null);
});
test('difference uses unrounded totals before rounding for every date-range length', () => {
  for (const count of [7, 14, 31, 365]) {
    const days = Array.from({ length: count }, () => ({ calories: 100.4, burned: 100.6 }));
    const result = summarizeCalorieBalance(days);
    assert.ok(result.totalDifference <= 0);
    assert.ok(result.averageDifference <= 0);
    assert.equal(result.averageDifference, Math.round(days.reduce((sum, day) => sum + day.calories - day.burned, 0) / count));
  }
});
