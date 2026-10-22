const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exported = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/utils/splitDashboardLayout.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: exported });
const { splitDashboardLayout } = exported;
test('ordinary phones and narrow application windows keep a single screen', () => {
  for (const [width, height] of [[390, 844], [430, 932], [800, 600], [900, 430], [0, 0]]) {
    assert.equal(splitDashboardLayout(width, height).split, false);
  }
});
test('an unfolded landscape display gives both panes usable widths', () => {
  for (const [width, height] of [[956, 680], [1194, 834], [1366, 1024]]) {
    const layout = splitDashboardLayout(width, height);
    assert.equal(layout.split, true);
    assert.ok(layout.left > 400);
    assert.ok(width - layout.left - 1 > 400);
  }
});
test('folding back restores a single full-width pane', () => {
  assert.equal(splitDashboardLayout(956, 680).split, true);
  assert.equal(splitDashboardLayout(440, 956).left, 440);
  assert.equal(splitDashboardLayout(440, 956).split, false);
});
