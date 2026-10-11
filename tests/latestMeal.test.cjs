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

test('live records support timestamp objects and invalid cached dates fall back to persisted timestamps', () => {
  const { mealTimestamp } = output;
  const now = Date.parse('2026-10-11T18:00:00Z');
  const fresh = { timestamp: { seconds: now / 1000 } };
  assert.equal(mealTimestamp(fresh), now);
  assert.equal(getLatestMeal([{ timestamp: '2026-10-10T00:00:00Z' }, fresh]), fresh);
  assert.equal(mealTimestamp({ dateObj: 'invalid', timestamp: '2026-10-11T18:00:00Z' }), now);
  assert.equal(mealTimestamp({ timestamp: { toDate: () => new Date(now) } }), now);
});
test('new meal is immediately selected from a live snapshot before any restart', () => {
  const previous = { id: 'old', timestamp: '2026-10-11T12:00:00Z' };
  const fresh = { id: 'new', timestamp: '2026-10-11T18:00:00Z' };
  assert.equal(getLatestMeal([previous]), previous);
  const latest = getLatestMeal([fresh, previous]);
  assert.equal(latest, fresh);
  assert.equal(Math.max(0, Math.floor((Date.parse(fresh.timestamp) - output.mealTimestamp(latest)) / 60000)), 0);
});
