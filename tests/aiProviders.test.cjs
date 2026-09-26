const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    const file = path.resolve(__dirname, '..', filename);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
      babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
    });
    vm.runInNewContext(code, {
      exports, console: { log() {}, warn() {}, error() {} }, setTimeout, ...globals,
      require: id => {
        if (id in mocks) return mocks[id];
        if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.js'));
        throw new Error('Unmocked import: ' + id);
      },
    }, { filename: file });
    return exports;
  }
  return load;
}

function keyStore() {
  const ordinary = new Map([['settings.v1', '{"aiModel":"custom-gemini"}'], ['meals', 'history-untouched']]);
  const secure = new Map();
  let failIndex = false, failSecret = false;
  const mocks = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': { documentDirectory: 'file:///data/user/0/app/files/' },
    '@react-native-async-storage/async-storage': {
      getItem: async key => ordinary.get(key) || null,
      setItem: async (key, value) => { if (failIndex) throw new Error('Disk full'); ordinary.set(key, value); },
      removeItem: async key => { ordinary.delete(key); },
    },
    'expo-secure-store': {
      getItemAsync: async key => secure.get(key) || null,
      setItemAsync: async (key, value) => { if (failSecret) throw new Error('Keychain unavailable'); secure.set(key, value); },
      deleteItemAsync: async key => { secure.delete(key); },
    },
  };
  return { ordinary, secure, reload: () => loader(mocks)('src/utils/apiKeys.js'),
    failIndex: value => { failIndex = value; }, failSecret: value => { failSecret = value; } };
}

test('iOS simulator stores keys without calling unavailable Keychain', async () => {
  const values = new Map();
  const api = loader({
    'react-native': { Platform: { OS: 'ios' } },
    'expo-file-system/legacy': { documentDirectory: 'file:///Users/test/Library/Developer/CoreSimulator/Devices/123/data/Containers/Data/Application/456/Documents/' },
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) || null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async key => { values.delete(key); },
    },
    'expo-secure-store': {
      getItemAsync: async () => { throw new Error('A required entitlement is not present'); },
      setItemAsync: async () => { throw new Error('A required entitlement is not present'); },
      deleteItemAsync: async () => { throw new Error('A required entitlement is not present'); },
    },
  })('src/utils/apiKeys.js');
  assert.deepEqual(Array.from((await api.listApiKeys()).keys), []);
  const index = await api.saveApiKey({ provider: 'gemini', name: 'Test', secret: 'sim-secret' });
  assert.equal(await api.getActiveApiKey('gemini'), 'sim-secret');
  await api.deleteApiKey(index.active.gemini);
  assert.equal(await api.getActiveApiKey('gemini'), null);
});

test('legacy Gemini key migrates once, survives restart, and never reappears after deletion', async () => {
  const store = keyStore();
  store.secure.set('gemini_api_key', ' original-secret ');
  const api = store.reload();
  const index = await api.listApiKeys();
  assert.equal(index.keys.length, 1);
  assert.equal(await api.getActiveApiKey('gemini'), 'original-secret');
  assert.equal(await store.reload().getActiveApiKey('gemini'), 'original-secret');
  assert.equal(store.secure.has('gemini_api_key'), false);
  assert.ok(!store.ordinary.get('ai-key-index.v1').includes('original-secret'));
  await api.deleteApiKey(index.keys[0].id);
  assert.equal(await store.reload().getActiveApiKey('gemini'), null);
  assert.equal(store.ordinary.get('meals'), 'history-untouched');
  assert.equal(store.ordinary.get('settings.v1'), '{"aiModel":"custom-gemini"}');
});

test('failed migration preserves original key and retries safely', async () => {
  const store = keyStore();
  store.secure.set('gemini_api_key', 'original-secret');
  store.failIndex(true);
  await assert.rejects(store.reload().listApiKeys(), /Disk full/);
  assert.equal(store.secure.get('gemini_api_key'), 'original-secret');
  store.failIndex(false);
  const api = store.reload();
  assert.equal((await api.listApiKeys()).keys.length, 1);
  assert.equal(await api.getActiveApiKey('gemini'), 'original-secret');
});

test('multiple keys remain isolated by provider, activation and deletion persist', async () => {
  const store = keyStore(), api = store.reload();
  await Promise.all([
    api.saveApiKey({ provider: 'gemini', name: 'Personal', secret: 'gemini-one' }),
    api.saveApiKey({ provider: 'openai', name: 'Personal', secret: 'openai-one' }),
    api.saveApiKey({ provider: 'openai', name: 'Work', secret: 'openai-two' }),
    api.saveApiKey({ provider: 'claude', name: 'Personal', secret: 'claude-one' }),
  ]);
  let index = await api.listApiKeys();
  assert.equal(index.keys.length, 4);
  assert.equal(await api.getActiveApiKey('openai'), 'openai-one');
  const work = index.keys.find(key => key.name === 'Work');
  await assert.rejects(api.activateApiKey('claude', work.id));
  await api.activateApiKey('openai', work.id);
  assert.equal(await store.reload().getActiveApiKey('openai'), 'openai-two');
  await api.deleteApiKey(work.id);
  assert.equal(await api.getActiveApiKey('openai'), 'openai-one');
  assert.equal(await api.getActiveApiKey('gemini'), 'gemini-one');
  assert.equal(await api.getActiveApiKey('claude'), 'claude-one');
});

test('editing a name keeps the secret, failed replacement preserves the selected key', async () => {
  const store = keyStore(), api = store.reload();
  let index = await api.saveApiKey({ provider: 'openai', name: 'Old name', secret: 'original-secret' });
  index = await api.saveApiKey({ provider: 'openai', id: index.active.openai, name: 'New name', secret: '' });
  assert.equal(index.keys[0].name, 'New name');
  assert.equal(await api.getActiveApiKey('openai'), 'original-secret');
  store.failIndex(true);
  await assert.rejects(api.saveApiKey({ provider: 'openai', id: index.active.openai, name: 'Changed', secret: 'replacement-secret' }), /Disk full/);
  store.failIndex(false);
  assert.equal(await api.getActiveApiKey('openai'), 'original-secret');
  assert.equal(store.secure.size, 1);
  store.failSecret(true);
  await assert.rejects(api.saveApiKey({ provider: 'openai', id: index.active.openai, name: 'Changed', secret: 'replacement-secret' }), /Keychain/);
  assert.equal(await api.getActiveApiKey('openai'), 'original-secret');
  await assert.rejects(api.saveApiKey({ provider: 'openai', name: 'Bad', secret: 'two words' }), /invalid_api_key/);
});

const food = { error: null, name: 'Jablko', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, weight_g: 100, confidence: 0.9 };
const response = (provider, result = food) => provider === 'openai'
  ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }
  : provider === 'claude' ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'food_analysis', input: result }] }
  : { candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] };

function apiClient(replies, options = {}) {
  const calls = [], keyRequests = [];
  const load = loader({
    'react-native': { Platform: { OS: 'android' } },
    '../utils/apiKeys': { getActiveApiKey: async provider => { keyRequests.push(provider); return options.missing === provider ? null : provider + '-test-secret'; } },
  }, {
    FormData: class { constructor() { this.fields = {}; } append(name, value) { this.fields[name] = value; } },
    fetch: async (url, init) => {
      calls.push({ url, ...init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
      const next = replies.shift();
      if (!next) throw new Error('Unexpected request');
      if (options.onResponse) options.onResponse(calls.length);
      return { ok: !next.httpStatus, status: next.httpStatus || 200, json: async () => next, text: async () => JSON.stringify(next) };
    },
  });
  return { analyze: load('src/api/providers.js').analyzeWithProvider, friendly: load('src/api/backend.js').getFriendlyError, calls, keyRequests };
}

for (const provider of ['gemini', 'openai', 'claude']) {
  for (const mode of ['text', 'image']) {
    test(`${provider}: ${mode} uses only its active key, preserves language and nutrition`, async () => {
      const client = apiClient([response(provider)]);
      const result = await client.analyze({ aiProvider: provider, language: 'sk', ...(mode === 'image' ? { base64Data: 'IMAGE', mimeType: 'image/jpeg', weightG: 100 } : { text: 'jablko' }) });
      assert.equal(result.name, 'Jablko');
      assert.equal(result.calories, 52);
      assert.deepEqual(client.keyRequests, [provider]);
      const request = client.calls[0];
      assert.ok(!request.url.includes('test-secret'));
      assert.ok(!JSON.stringify(request.body).includes('test-secret'));
      assert.ok(Object.values(request.headers).some(value => value.includes(provider + '-test-secret')));
      if (provider === 'openai') {
        assert.equal(request.body.store, false);
        assert.equal(request.body.text.format.strict, true);
        assert.ok(request.body.input[0].content[0].text.includes('Slovak'));
        if (mode === 'image') assert.equal(request.body.input[0].content[1].image_url, 'data:image/jpeg;base64,IMAGE');
      } else if (provider === 'claude') {
        assert.equal(request.headers['anthropic-version'], '2023-06-01');
        if (mode === 'image') assert.equal(request.body.messages[0].content[0].source.data, 'IMAGE');
      }
    });
  }
}

test('OpenAI voice analyzes the transcript without stale typed food context', async () => {
  const client = apiClient([{ text: 'jablko' }, response('openai')]);
  await client.analyze({ aiProvider: 'openai', language: 'sk', audioUri: 'file:///recording.m4a', audioMimeType: 'audio/mp4', text: '100 g' });
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].body.fields.file.uri, 'file:///recording.m4a');
  assert.equal(client.calls[0].body.fields.file.type, 'audio/mp4');
  assert.equal(client.calls[0].headers['Content-Type'], undefined);
  assert.equal(client.calls[0].body.fields.language, 'sk');
  const prompt = client.calls[1].body.input[0].content[0].text;
  assert.ok(prompt.includes('jablko'));
  assert.ok(!prompt.includes('100 g'));
});

test('Gemini voice transcribes before analysis and never forwards old typed text', async () => {
  const transcript = { candidates: [{ content: { parts: [{ text: JSON.stringify({ has_speech: true, transcript: 'jablko' }) }] } }] };
  const client = apiClient([transcript, response('gemini')]);
  await client.analyze({ audioBase64: 'AUDIO', audioMimeType: 'audio/mp4', text: 'staré jedlo' });
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].body.contents[0].parts[1].inline_data.data, 'AUDIO');
  assert.equal(client.calls[0].body.contents[0].parts[1].inline_data.mime_type, 'audio/mp4');
  const analysisRequest = JSON.stringify(client.calls[1].body);
  assert.ok(analysisRequest.includes('jablko'));
  assert.ok(!analysisRequest.includes('AUDIO'));
  assert.ok(!analysisRequest.includes('staré jedlo'));
});

test('Gemini voice stops before nutrition analysis when no intelligible speech is detected', async () => {
  const noSpeech = { candidates: [{ content: { parts: [{ text: JSON.stringify({ has_speech: false, transcript: '' }) }] } }] };
  const client = apiClient([noSpeech]);
  await assert.rejects(client.analyze({ audioBase64: 'NOISE' }), /empty_transcription/);
  assert.equal(client.calls.length, 1);
});

test('Claude voice sends nothing without explicit transcription configuration', async () => {
  const client = apiClient([]);
  await assert.rejects(client.analyze({ aiProvider: 'claude', audioUri: 'file:///voice.m4a' }), /claude_voice_setup/);
  assert.equal(client.calls.length, 0);
});

for (const transcriber of ['openai', 'gemini']) {
  test(`Claude voice uses only the configured ${transcriber} transcriber, then Claude`, async () => {
    const transcript = transcriber === 'openai' ? { text: 'jablko' } : { candidates: [{ content: { parts: [{ text: JSON.stringify({ has_speech: true, transcript: 'jablko' }) }] } }] };
    const client = apiClient([transcript, response('claude')]);
    await client.analyze({ aiProvider: 'claude', claudeVoiceProvider: transcriber, audioUri: 'file:///voice.m4a', audioBase64: 'AUDIO' });
    assert.deepEqual(client.keyRequests, ['claude', transcriber]);
    assert.equal(client.calls.length, 2);
    assert.ok(client.calls[1].url.includes('anthropic'));
    assert.ok(JSON.stringify(client.calls[1].body).includes('jablko'));
    assert.ok(!JSON.stringify(client.calls[1].body).includes('AUDIO'));
    assert.ok(!JSON.stringify(client.calls[1]).includes(transcriber + '-test-secret'));
  });
}

test('missing keys, failed transcription and cancellation never trigger another provider request', async () => {
  const missing = apiClient([], { missing: 'openai' });
  await assert.rejects(missing.analyze({ aiProvider: 'openai', text: 'jablko' }), error => error.message === 'missing_api_key' && error.provider === 'openai');
  assert.equal(missing.calls.length, 0);
  const silent = apiClient([{ text: '' }]);
  await assert.rejects(silent.analyze({ aiProvider: 'openai', audioUri: 'file:///audio.m4a' }), /empty_transcription/);
  assert.equal(silent.calls.length, 1);
  const controller = new AbortController();
  const cancelled = apiClient([{ text: 'jablko' }], { onResponse: () => controller.abort() });
  await assert.rejects(cancelled.analyze({ aiProvider: 'openai', audioUri: 'file:///audio.m4a', signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(cancelled.calls.length, 1);
  assert.equal(cancelled.calls[0].signal, controller.signal);
});

test('invalid, incomplete, refused and non-food responses are never accepted as meals', async () => {
  for (const result of [{ ...food, calories: -1 }, { ...food, calories: null }, { ...food, name: '' }, { ...food, confidence: 3 }]) {
    await assert.rejects(apiClient([response('openai', result)]).analyze({ aiProvider: 'openai', text: 'test' }), /Invalid format/);
  }
  await assert.rejects(apiClient([{ ...response('openai'), status: 'incomplete' }]).analyze({ aiProvider: 'openai', text: 'test' }), /Invalid format/);
  await assert.rejects(apiClient([{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }]).analyze({ aiProvider: 'openai', text: 'test' }), /Invalid format/);
  for (const provider of ['openai', 'claude', 'gemini']) {
    await assert.rejects(apiClient([response(provider, { error: 'not_food' })]).analyze({ aiProvider: provider, text: 'rock' }), /not_food/);
  }
});

test('authentication and quota failures expose useful status without provider response bodies', async () => {
  for (const status of [401, 403, 429, 500]) {
    const client = apiClient([{ httpStatus: status, error: { message: 'private-secret-data' } }]);
    await assert.rejects(client.analyze({ aiProvider: 'openai', text: 'jablko' }), error => {
      assert.equal(error.status, status);
      assert.ok(!JSON.stringify(client.friendly(error)).includes('private-secret-data'));
      return true;
    });
    assert.equal(client.calls.length, 1);
  }
});

test('all UI languages include the complete provider settings and error labels', () => {
  const { aiTranslations } = loader()('src/i18n/aiTranslations.js');
  const keys = Object.keys(aiTranslations.en).sort();
  for (const language of ['sk', 'en', 'cs', 'de', 'es', 'fr', 'it', 'pl']) {
    assert.deepEqual(Object.keys(aiTranslations[language]).sort(), keys);
    assert.ok(Object.values(aiTranslations[language]).every(value => typeof value === 'string' && value.trim()));
  }
});

test('settings migration preserves the Gemini model and remembers a separate model per provider across restart', async () => {
  let persisted = JSON.stringify({ aiModel: 'my-old-gemini', dailyGoal: 2500, customModels: [{ id: 'my-old-gemini', label: 'My Gemini', isCustom: true }] });
  async function mount() {
    const states = [], dependencies = [], effects = [];
    let stateCursor = 0, effectCursor = 0;
    const react = {
      createContext: () => ({ Provider: 'Provider' }),
      createElement: (_, props) => props.value,
      useState: initial => { const i = stateCursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useMemo: fn => fn(),
      useEffect: (fn, deps) => {
        const i = effectCursor++;
        if (!dependencies[i] || deps.some((dep, j) => dep !== dependencies[i][j])) { dependencies[i] = deps; effects.push(fn); }
      },
    };
    const { SettingsProvider } = loader({
      react,
      'react-native': { useColorScheme: () => 'light' },
      'expo-localization': { getLocales: () => [{ languageCode: 'sk' }] },
      '@react-native-async-storage/async-storage': { getItem: async () => persisted, setItem: async (_, value) => { persisted = value; } },
    })('src/state/SettingsContext.js');
    const render = async () => {
      stateCursor = 0; effectCursor = 0;
      const value = SettingsProvider({ children: null });
      for (const fn of effects.splice(0)) fn();
      await new Promise(resolve => setImmediate(resolve));
      return value;
    };
    await render();
    return { render, value: await render() };
  }
  const app = await mount();
  assert.equal(app.value.aiProvider, 'gemini');
  assert.equal(app.value.aiModel, 'my-old-gemini');
  assert.equal(app.value.dailyGoal, 2500);
  app.value.setAiProvider('openai');
  let value = await app.render();
  assert.equal(value.aiModel, 'gpt-4.1-mini');
  value.setAiModel('gpt-4.1');
  value = await app.render();
  value.setAiProvider('claude');
  value = await app.render();
  assert.equal(value.aiModel, 'claude-haiku-4-5');
  value.setAiModel('claude-sonnet-4-6');
  value.setClaudeVoiceProvider('openai');
  value = await app.render();
  const restarted = await mount();
  assert.equal(restarted.value.aiProvider, 'claude');
  assert.equal(restarted.value.aiModel, 'claude-sonnet-4-6');
  assert.equal(restarted.value.claudeVoiceProvider, 'openai');
  restarted.value.setAiProvider('gemini');
  value = await restarted.render();
  assert.equal(value.aiModel, 'my-old-gemini');
  assert.equal(value.customModels[0].id, 'my-old-gemini');
  value.setAiProvider('openai');
  value = await restarted.render();
  assert.equal(value.aiModel, 'gpt-4.1');
  assert.equal(value.dailyGoal, 2500);
});
