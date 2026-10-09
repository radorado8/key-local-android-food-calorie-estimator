const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function setup({ complete, vision = true, failStore = false, architecture = 'qwen35' } = {}) {
  const values = new Map();
  const files = new Set();
  const calls = [];
  const context = { initMultimodal: async options => { calls.push(['projector', options]); return true; },
    getMultimodalSupport: async () => ({ vision }),
    completion: async options => { calls.push(['completion', options]); return complete ? complete(options) : { text: JSON.stringify({ error: null, name: 'Apple', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, weight_g: 100, confidence: 0.7 }) }; },
    stopCompletion: async () => { calls.push(['stop']); }, release: async () => { calls.push(['release']); } };
  const mocks = {
    '@react-native-async-storage/async-storage': { getItem: async key => values.get(key), setItem: async (key, value) => { if (failStore) throw new Error('disk full'); values.set(key, value); }, removeItem: async key => values.delete(key) },
    'expo-file-system/legacy': { documentDirectory: 'file:///new/Documents/', makeDirectoryAsync: async () => {}, copyAsync: async ({ to }) => files.add(to), deleteAsync: async uri => { calls.push(['delete', uri]); files.delete(uri); }, getInfoAsync: async uri => ({ exists: files.has(uri) }) },
    'llama.rn': { loadLlamaModelInfo: async () => ({ 'general.architecture': architecture }), initLlama: async options => { calls.push(['init', options]); return context; } },
  };
  function load(file) {
    const exports = {};
    const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
    vm.runInNewContext(code, { exports, require: id => { if (id === 'llama.rn') calls.push(['native-import']); return mocks[id] || (id === './foodResult' ? load('src/api/foodResult.js') : (() => { throw new Error(id); })()); } });
    return exports;
  }
  return { api: load('src/api/localModel.js'), values, files, calls };
}
async function seed(env) {
  await env.api.importLocalModel({ name: 'boba.gguf', uri: 'file:///source/model' });
  await env.api.importLocalModel({ name: 'mmproj.gguf', uri: 'file:///source/projector' }, true);
}
test('local text uses no remote service and releases native memory', async () => {
  const env = setup(); await seed(env);
  const result = await env.api.analyzeLocally({ text: 'Apple' });
  assert.equal(result.calories, 52);
  assert.ok(env.calls.some(c => c[0] === 'release'));
  const request = env.calls.find(c => c[0] === 'completion')[1];
  assert.equal(request.enable_thinking, false);
  assert.equal(request.response_format.json_schema.schema.required.length, 8);
});
test('photo initializes projector and passes actual image', async () => {
  const env = setup(); await seed(env);
  await env.api.analyzeLocally({ base64Data: 'PHOTO', mimeType: 'image/png' });
  assert.ok(env.calls.some(c => c[0] === 'projector'));
  assert.equal(env.calls.find(c => c[0] === 'completion')[1].messages[0].content[1].image_url.url, 'data:image/png;base64,PHOTO');
});
test('rejects voice, absent model and absent projector explicitly', async () => {
  const env = setup();
  await assert.rejects(env.api.analyzeLocally({ audioUri: 'recording.m4a' }), /local_voice_unavailable/);
  await assert.rejects(env.api.analyzeLocally({ text: 'Apple' }), /local_model_missing/);
  await env.api.importLocalModel({ name: 'model.gguf', uri: 'source' });
  await assert.rejects(env.api.analyzeLocally({ base64Data: 'PHOTO' }), /local_projector_missing/);
});
test('abort stops inference and rejects partial result; concurrent analysis rejected', async () => {
  let finish; const env = setup({ complete: () => new Promise(resolve => { finish = resolve; }) }); await seed(env);
  const controller = new AbortController();
  const pending = env.api.analyzeLocally({ text: 'Apple', signal: controller.signal });
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(env.api.analyzeLocally({ text: 'Apple' }), /local_model_busy/);
  controller.abort(); finish({ text: '{}' });
  await assert.rejects(pending, /Aborted/);
  assert.ok(env.calls.some(c => c[0] === 'stop'));
  assert.ok(env.calls.some(c => c[0] === 'release'));
});
test('invalid model output is not saved as food and native context is released', async () => {
  const env = setup({ complete: async () => ({ text: '{}' }) }); await seed(env);
  await assert.rejects(env.api.analyzeLocally({ text: 'Apple' }), /Invalid format/);
  assert.ok(env.calls.some(c => c[0] === 'release'));
});
test('failed import leaves no orphan weight and configuration stays untouched', async () => {
  const env = setup({ failStore: true });
  await assert.rejects(env.api.importLocalModel({ name: 'model.gguf', uri: 'source' }), /disk full/);
  assert.equal(env.files.size, 0); assert.equal(env.values.size, 0);
});

test('Gemma 4 uses its required Jinja template while Boba retains its native template', async () => {
  for (const architecture of ['gemma4', 'qwen35']) {
    const env = setup({ architecture }); await seed(env);
    await env.api.analyzeLocally({ text: '100 g jablko' });
    assert.equal(env.calls.find(c => c[0] === 'completion')[1].jinja, architecture === 'gemma4');
  }
});

test('local output defaults to English independently of input and interface language', async () => {
  const env = setup(); await seed(env);
  await env.api.analyzeLocally({ text: '100 g jablko', language: 'sk' });
  const prompt = env.calls.find(c => c[0] === 'completion')[1].messages[0].content;
  assert.match(prompt, /name in English/); assert.match(prompt, /100 g jablko/);
  assert.equal((await env.api.getLocalModel()).outputLanguage, 'en');
});
test('app-language preference applies to text and photo and survives replacing or deleting models', async () => {
  const env = setup(); await seed(env); await env.api.setLocalOutputLanguage('app');
  await env.api.analyzeLocally({ text: 'jablko', language: 'sk' });
  await env.api.analyzeLocally({ base64Data: 'PHOTO', language: 'de' });
  const requests = env.calls.filter(c => c[0] === 'completion');
  assert.match(requests[0][1].messages[0].content, /name in Slovak/);
  assert.match(requests[1][1].messages[0].content[0].text, /name in German/);
  await seed(env); assert.equal((await env.api.getLocalModel()).outputLanguage, 'app');
  await env.api.deleteLocalModel(); assert.equal((await env.api.getLocalModel()).outputLanguage, 'app');
  await env.api.setLocalOutputLanguage('en'); assert.equal((await env.api.getLocalModel()).outputLanguage, 'en');
  await assert.rejects(env.api.setLocalOutputLanguage('invalid'), /local_language_invalid/);
});

test('startup and reading saved model settings never initialize native runtime or load weights', async () => {
  const env = setup();
  env.values.set('local-food-model.v1', JSON.stringify({ model: 'saved.gguf', projector: 'projector.gguf' }));
  const files = await env.api.getLocalModel();
  assert.match(files.model, /saved.gguf$/);
  await env.api.setLocalOutputLanguage('en'); await env.api.getLocalModel();
  assert.equal(env.calls.length, 0);
});
