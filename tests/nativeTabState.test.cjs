const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
const { code } = babel.transformSync(fs.readFileSync(require('node:path').join(__dirname, '../src/navigation/nativeTabState.js'), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
vm.runInNewContext(code, { exports: exportsObject });
const { applyNativeTabSelection, nativeContentFrame } = exportsObject;
const state = { index: 0, routes: [{ key: 'home', name: 'Scanner' }, { key: 'history', name: 'History' }] };
function navigation(prevent = false) {
  const calls = [];
  return { calls, emit: event => { calls.push(event.type); return { defaultPrevented: prevent }; }, navigate: name => calls.push(name) };
}
test('native tab user selection navigates once and supports cancelling a press', () => {
  const nav = navigation();
  applyNativeTabSelection(state, nav, { selectedScreenKey: 'history', actionOrigin: 'user' });
  assert.deepEqual(nav.calls, ['tabPress', 'History']);
  const prevented = navigation(true);
  applyNativeTabSelection(state, prevented, { selectedScreenKey: 'history', actionOrigin: 'user' });
  assert.deepEqual(prevented.calls, ['tabPress']);
});
test('JS acknowledgements and unknown native keys do not retrigger search/navigation', () => {
  const nav = navigation();
  applyNativeTabSelection(state, nav, { selectedScreenKey: 'history', actionOrigin: 'programmatic-js' });
  applyNativeTabSelection(state, nav, { selectedScreenKey: 'removed', actionOrigin: 'user' });
  assert.deepEqual(nav.calls, []);
});
test('system folding transitions reconcile selected tabs without a synthetic user press', () => {
  const nav = navigation();
  applyNativeTabSelection(state, nav, { selectedScreenKey: 'history', actionOrigin: 'implicit' });
  assert.deepEqual(nav.calls, ['History']);
});
test('content rectangles respect asymmetric bars and window position without hardcoded rail width', () => {
  assert.equal(JSON.stringify(nativeContentFrame({ x: 100, y: 54, width: 867, height: 600 }, { x: 100, y: 20 })), JSON.stringify({ left: 0, top: 34, width: 867, height: 600 }));
  assert.equal(nativeContentFrame({ x: 0, y: 0, width: 0, height: 600 }, { x: 0, y: 0 }), null);
  assert.equal(nativeContentFrame({ x: NaN, y: 0, width: 450, height: 600 }, { x: 0, y: 0 }), null);
});

test('Home is hidden only while pinned next to the detail pane, then returns when folded', () => {
  const { nativeTabRoutes } = exportsObject;
  const open = nativeTabRoutes(state, true, 'history');
  assert.equal(open.routes.length, 1);
  assert.equal(open.active.name, 'History');
  const folded = nativeTabRoutes(state, false, 'history');
  assert.equal(folded.routes.length, 2);
  assert.equal(folded.active.name, 'Scanner');
});
