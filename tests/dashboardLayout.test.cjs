const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/utils/dashboardLayout.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: exportsObject });
const { dashboardButtonHeights, latestMealFitsInitially } = exportsObject;
test('latest meal uses space that otherwise enlarges buttons', () => {
  const without = dashboardButtonHeights(700, 430, false);
  const withMeal = dashboardButtonHeights(700, 520, true);
  assert.ok(without.actions > withMeal.actions);
  assert.ok(withMeal.actions >= 72);
  assert.ok(withMeal.text >= 48);
});
test('buttons never shrink below readable minimum or grow past maximum', () => {
  for (const viewport of [320, 500, 700, 1200]) {
    const sizes = dashboardButtonHeights(viewport, 530, true);
    assert.ok(sizes.text >= 48 && sizes.text <= 168);
    assert.ok(sizes.actions >= 64 && sizes.actions <= 116);
  }
  const scaled = dashboardButtonHeights(320, 530, true, 2);
  assert.ok(scaled.text >= 82 && scaled.actions >= 124);
});
test('voice and text buttons grow in spacious layouts but stay below photo actions', () => {
  const sizes = dashboardButtonHeights(1000, 430, false);
  assert.ok(sizes.text > 76);
  assert.ok(sizes.actions <= 116);
});
test('automatic first-run choice requires enough room for the panel and readable buttons', () => {
  assert.equal(latestMealFitsInitially(600, 400), false);
  assert.equal(latestMealFitsInitially(800, 400), true);
});
