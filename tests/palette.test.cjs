const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/theme/palette.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: exportsObject });
const { COLOR_THEMES, getPalette } = exportsObject;
function luminance(hex) {
  return hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// The legacy palette intentionally preserves its original contrast and alpha colors.
for (const theme of COLOR_THEMES.filter(id => id !== 'original')) for (const mode of ['light', 'dark']) {
  test(`${theme} ${mode}: readable labels, opaque dialogs and primary buttons`, () => {
    const c = getPalette(mode, theme);
    for (const surface of [c.bg, c.card, c.elemBg]) {
      for (const text of [c.text, c.muted]) assert.ok(contrast(text, surface) >= 4.5, `${text} on ${surface}`);
    }
    assert.ok(contrast(c.onAccent, c.accent) >= 4.5);
    assert.ok(contrast(c.accent, c.card) >= 4.5);
    assert.ok(contrast(c.calories, c.bg) >= 4.5);
    assert.match(c.modalBg, /^#[0-9A-F]{6}$/i);
  });
}
test('existing installations and unknown palettes use original', () => {
  assert.deepEqual(getPalette('light'), getPalette('light', 'original'));
  assert.deepEqual(getPalette('dark', 'invalid'), getPalette('dark', 'original'));
});
