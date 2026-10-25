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

test('Duo split follows the physical midpoint including its right navigation rail', () => {
  const { left } = splitDashboardLayout(867, 635, { windowWidth: 951, contentLeft: 0 });
  assert.equal(left, 475);
  assert.equal(867 - left - 1 + 84, left);
});
test('a system rail on the left stays inside the left physical half', () => {
  const { left } = splitDashboardLayout(867, 635, { windowWidth: 951, contentLeft: 84 });
  assert.equal(left + 84, 867 - left - 1);
});
test('phone geometry never enables a two-pane layout on a compact display', () => {
  assert.equal(splitDashboardLayout(382, 644, { windowWidth: 466, contentLeft: 0 }).split, false);
});

test('Home shares the right half with the native rail, leaving History wider', () => {
  const layout = splitDashboardLayout(867, 635, { windowWidth: 951, contentLeft: 0 });
  assert.equal(layout.homeOnRight, true);
  assert.equal(layout.homeWidth, 391);
  assert.equal(layout.detailWidth, 475);
  assert.equal(layout.homeWidth + 84, layout.detailWidth);
});
test('Home follows a left rail and compact phones stay full width', () => {
  const layout = splitDashboardLayout(867, 635, { windowWidth: 951, contentLeft: 84 });
  assert.equal(layout.homeOnRight, false);
  assert.equal(layout.homeWidth, 391);
  assert.equal(layout.detailWidth, 475);
  assert.equal(splitDashboardLayout(390, 844).left, 390);
});
test('Android and layouts without a native rail keep Home on the left', () => {
  const layout = splitDashboardLayout(956, 680);
  assert.equal(layout.homeOnRight, false);
  assert.equal(layout.homeWidth, layout.left);
});
