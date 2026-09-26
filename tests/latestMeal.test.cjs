const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const output = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/utils/latestMeal.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: output });
const { getLatestMeal } = output;
test('latest meal follows timestamps after import without reordering stored meals', () => {
  const old = { timestamp: '2026-09-20T10:00:00Z' };
  const recent = { timestamp: '2026-09-25T12:00:00Z', name: 'Lunch', imageUri: 'file://photo.jpg' };
  const meals = [old, recent, { timestamp: 'invalid' }];
  assert.equal(getLatestMeal(meals), recent);
  assert.equal(meals[0], old);
  assert.equal(getLatestMeal([old]), old);
});
test('empty history and invalid dates have no preview, Date objects are supported', () => {
  assert.equal(getLatestMeal([]), null);
  assert.equal(getLatestMeal(null), null);
  assert.equal(getLatestMeal([{}]), null);
  const meal = { dateObj: new Date('2026-09-26T10:00:00Z') };
  assert.equal(getLatestMeal([meal]), meal);
});
