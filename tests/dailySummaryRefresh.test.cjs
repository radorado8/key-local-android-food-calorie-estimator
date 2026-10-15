const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const mealTypes = {};
vm.runInNewContext(babel.transformSync(fs.readFileSync(require.resolve('../src/utils/mealTypes.js'), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code, { exports: mealTypes });

function harness(platform = 'android') {
  let tree;
  let epoch = new Date(2026, 9, 13, 23, 59).getTime();
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [epoch])); } static now() { return epoch; } }
  const states = [], effects = [], pending = [];
  let stateIndex, effectIndex, timer, foreground, subscriptions = 0;
  const meals = [{ dateObj: new Date(2026, 9, 13, 19), calories: 800, protein: 30 }, { dateObj: new Date(2026, 9, 14, 8), calories: 200, protein: 10 }];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useMemo: fn => fn(),
    useEffect(fn, deps) {
      const i = effectIndex++;
      if (!effects[i] || deps.some((value, index) => value !== effects[i].deps[index])) {
        pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const mocks = {
    react,
    'react-native': { AppState: { addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } }, Platform: { OS: platform }, StyleSheet: { create: value => value } },
    'react-native-svg': {},
    '../utils/calorieExpenditure': { localDateKey: date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` },
    '../utils/mealTypes': mealTypes,
    '../utils/latestMeal': { getLatestMeal: () => null },
    './MealElapsedIndicator': 'MealElapsedIndicator',
    '../api/mealService': { subscribeToMeals: (_, callback) => { subscriptions++; callback(meals); return () => {}; } },
    '../hooks/useTranslation': { useTranslation: () => translation },
    '../state/SettingsContext': { useSettings: () => ({ language: 'sk', macroGoals: { protein: 100, carbs: 200, fat: 70 }, showMealElapsed: true }) },
  };
  const translation = {};
  const exports = {};
  const { code } = babel.transformSync(fs.readFileSync(require.resolve('../src/components/DailySummary.js'), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] });
  vm.runInNewContext(code, { exports, Date: ClockDate, require: id => { if (!(id in mocks)) throw Error(id); return mocks[id]; }, setInterval: fn => { timer = fn; return 1; }, clearInterval() {} });
  const render = () => { stateIndex = effectIndex = 0; tree = exports.default({ colors: { macros: {} } }); pending.splice(0).forEach(fn => fn()); };
  render(); render();
  return { render, states, get tree() { return tree; }, get subscriptions() { return subscriptions; }, advance: () => { epoch = new Date(2026, 9, 14, 8, 30).getTime(); }, tick: () => timer(), resume: () => foreground('active') };
}
for (const event of ['tick', 'resume']) test(`dashboard refreshes meals and macros on the new local day via ${event}`, () => {
  const app = harness();
  assert.equal(app.states[0].calories, 800);
  app[event](); app.render();
  assert.equal(app.subscriptions, 1, 'does not reload on every clock tick');
  app.advance(); app[event](); app.render(); app.render();
  assert.equal(app.states[0].calories, 200);
  assert.equal(app.states[0].protein, 10);
  assert.equal(app.subscriptions, 2);
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return (node.children || []).flat(Infinity).map(child => find(child, predicate)).find(Boolean);
}
for (const platform of ['ios', 'android']) test(`${platform}: elapsed indicator keeps phone width and spans wide cards without growing the ring`, () => {
  const app = harness(platform);
  const overlay = () => find(app.tree, node => node.props.pointerEvents === 'box-none');
  const ring = () => find(app.tree, node => Array.isArray(node.props.style) && node.props.style[0]?.width === 312);
  app.tree.props.onLayout({ nativeEvent: { layout: { width: 320 } } }); app.render();
  assert.equal(overlay().props.style.width, 312);
  assert.equal(find(app.tree, node => node.type === 'MealElapsedIndicator').props.inset, 0);
  const height = ring().props.style[1].height;
  app.tree.props.onLayout({ nativeEvent: { layout: { width: 580 } } }); app.render();
  assert.equal(overlay().props.style.width, '100%');
  assert.equal(find(app.tree, node => node.type === 'MealElapsedIndicator').props.inset, 4);
  assert.equal(ring().props.style[1].height, height);
});
