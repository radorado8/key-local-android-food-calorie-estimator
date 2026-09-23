const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const moduleExports = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/utils/macroGoals.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: moduleExports });
const { resolveMacroGoals, validMacroGoals } = moduleExports;
test('automatic targets follow calories with 4/4/9 energy factors', () => {
  assert.equal(JSON.stringify(resolveMacroGoals(2100)), JSON.stringify({ protein: 105, carbs: 263, fat: 70 }));
  assert.equal(JSON.stringify(resolveMacroGoals(2000)), JSON.stringify({ protein: 100, carbs: 250, fat: 67 }));
});
test('custom gram targets survive calorie changes and storage round trips', () => {
  const custom = JSON.parse(JSON.stringify({ protein: 120.5, carbs: 210, fat: 65 }));
  assert.equal(resolveMacroGoals(1500, custom), custom);
  assert.equal(resolveMacroGoals(3000, custom), custom);
  assert.equal(resolveMacroGoals(3000, null).protein, 150);
});
test('old or invalid settings fall back to automatic goals without zero denominators', () => {
  for (const custom of [null, {}, { protein: 0, carbs: 1, fat: 1 }, { protein: -1, carbs: 1, fat: 1 }, { protein: NaN, carbs: 1, fat: 1 }, { protein: 3000, carbs: 1, fat: 1 }]) {
    assert.ok(!validMacroGoals(custom));
    assert.equal(resolveMacroGoals(2100, custom).protein, 105);
  }
  assert.equal(resolveMacroGoals(NaN).fat, 70);
});
