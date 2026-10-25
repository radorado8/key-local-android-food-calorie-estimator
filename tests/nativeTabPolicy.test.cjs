const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exported = {};
const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/navigation/nativeTabPolicy.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
vm.runInNewContext(code, { exports: exported });
const { usesNativeTabRail } = exported;
test('iPhone, Duo and physical iPad retain system navigation', () => {
  for (const interfaceIdiom of ['phone', 'pad']) {
    assert.equal(usesNativeTabRail({ OS: 'ios', constants: { interfaceIdiom } }, false), true);
  }
});
test('Designed for iPad on Mac uses bottom navigation even with pad idiom', () => {
  assert.equal(usesNativeTabRail({ OS: 'ios', constants: { interfaceIdiom: 'pad' } }, true), false);
});
test('Mac Catalyst and Mac interface idiom also use bottom navigation', () => {
  assert.equal(usesNativeTabRail({ OS: 'ios', isMacCatalyst: true }), false);
  assert.equal(usesNativeTabRail({ OS: 'ios', constants: { interfaceIdiom: 'mac' } }), false);
});
test('Android and web keep their current custom navigation', () => {
  for (const OS of ['android', 'web', 'macos']) assert.equal(usesNativeTabRail({ OS }), false);
});
