const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function mount(query = 'jablko') {
  const effects = [], frames = new Map(), listeners = {}, selections = [];
  let id = 0, searching = true, value = query, dismissals = 0, blurred = 0, params;
  const exports = {};
  const mocks = { react: { useRef: initial => ({ current: initial }), useCallback: fn => fn, useEffect: fn => effects.push(fn) },
    'react-native': { Keyboard: { dismiss: () => dismissals++ } } };
  const { code } = babel.transformSync(fs.readFileSync('src/hooks/useFoodSearchInput.js', 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  vm.runInNewContext(code, { exports, require: key => mocks[key],
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  const handlers = exports.default({ query, inputRef: { current: { blur: () => blurred++, setNativeProps: props => selections.push(props.selection) } },
    navigation: { addListener: (event, fn) => { listeners[event] = fn; return () => delete listeners[event]; }, setParams: next => { params = next; } },
    setQuery: next => { value = next; }, setSearching: next => { searching = next; } });
  const cleanup = effects[0]();
  return { handlers, blur: () => listeners.blur(), flush: () => { for (const fn of frames.values()) fn(); frames.clear(); }, cleanup,
    state: () => ({ searching, value, dismissals, blurred, params, selections }) };
}
test('leaving a search screen clears its query and pending home-search request', () => {
  const env = mount(); env.blur();
  const state = env.state(); assert.equal(state.searching, false); assert.equal(state.value, '');
  assert.equal(state.params.openSearch, undefined); assert.equal(state.blurred, 1); assert.equal(state.dismissals, 1);
});
test('after adding a meal, focusing the search again selects the complete previous query', () => {
  const env = mount('rožok s maslom'); env.handlers.blurInput();
  assert.equal(env.state().value, 'rožok s maslom'); assert.equal(env.state().searching, true);
  env.handlers.selectAll(); env.flush();
  assert.equal(env.state().selections[0].start, 0); assert.equal(env.state().selections[0].end, 14);
});
test('leaving or unmounting cancels selection queued by a search touch', () => {
  const env = mount(); env.handlers.selectAll(); env.blur(); env.flush(); assert.equal(env.state().selections.length, 0);
  const other = mount(); other.handlers.selectAll(); other.cleanup(); other.flush(); assert.equal(other.state().selections.length, 0);
});
test('repeated touch and focus events select once and an empty query is safe', () => {
  const env = mount(''); env.handlers.selectAll(); env.handlers.selectAll(); env.flush();
  assert.equal(env.state().selections.length, 1); assert.equal(env.state().selections[0].end, 0);
});
