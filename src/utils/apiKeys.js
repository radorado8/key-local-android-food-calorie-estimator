import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isAIProvider } from '../config/aiProviders';

const INDEX = 'ai-key-index.v1';
const LEGACY = 'gemini_api_key';
const readSecret = key => Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(key)) : SecureStore.getItemAsync(key);
const writeSecret = (key, value) => Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(key, value)) : SecureStore.setItemAsync(key, value);
const removeSecret = key => Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(key)) : SecureStore.deleteItemAsync(key);
const secretName = id => `ai_key_${id}`;
let sequence = 0;
let queue = Promise.resolve();
const serialize = task => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};
const validateProvider = provider => { if (!isAIProvider(provider)) throw new Error('Invalid AI provider'); };

async function readIndex() {
  const saved = await AsyncStorage.getItem(INDEX);
  if (saved) {
    const index = JSON.parse(saved);
    if (!index || !Array.isArray(index.keys) || !index.active) throw new Error('Invalid API key settings');
    return index;
  }
  const index = { keys: [], active: {} };
  const legacy = await readSecret(LEGACY);
  if (legacy?.trim()) {
    // A fixed ID makes migration safe to retry after interrupted writes.
    await writeSecret(secretName('legacy_gemini'), legacy.trim());
    index.keys.push({ id: 'legacy_gemini', provider: 'gemini', name: 'Gemini 1' });
    index.active.gemini = 'legacy_gemini';
  }
  await AsyncStorage.setItem(INDEX, JSON.stringify(index));
  // The index is the migration marker; a deleted key must never reappear.
  await removeSecret(LEGACY).catch(() => {});
  return index;
}

export const listApiKeys = () => serialize(readIndex);
export const getActiveApiKey = provider => serialize(async () => {
  validateProvider(provider);
  const index = await readIndex();
  const entry = index.keys.find(key => key.provider === provider && key.id === index.active[provider]);
  return entry ? readSecret(secretName(entry.id)) : null;
});

export const saveApiKey = ({ provider, id, name, secret }) => serialize(async () => {
  validateProvider(provider);
  const index = await readIndex();
  const existing = id ? index.keys.find(key => key.id === id && key.provider === provider) : null;
  if (id && !existing) throw new Error('API key no longer exists');
  const value = secret?.trim() || (existing && await readSecret(secretName(id)));
  if (!value || /\s/.test(value)) throw new Error('invalid_api_key');
  const newId = `${Date.now().toString(36)}_${++sequence}_${Math.random().toString(36).slice(2, 10)}`;
  const entry = { id: newId, provider, name: name.trim() || `${provider} ${index.keys.filter(key => key.provider === provider).length + 1}` };
  await writeSecret(secretName(newId), value);
  const next = {
    keys: existing ? index.keys.map(key => key.id === id ? entry : key) : [...index.keys, entry],
    active: { ...index.active },
  };
  if (!next.active[provider] || next.active[provider] === id) next.active[provider] = newId;
  try { await AsyncStorage.setItem(INDEX, JSON.stringify(next)); }
  catch (error) { await removeSecret(secretName(newId)).catch(() => {}); throw error; }
  if (existing) await removeSecret(secretName(id)).catch(() => {});
  return next;
});

export const activateApiKey = (provider, id) => serialize(async () => {
  validateProvider(provider);
  const index = await readIndex();
  if (!index.keys.some(key => key.id === id && key.provider === provider)) throw new Error('API key no longer exists');
  const next = { ...index, active: { ...index.active, [provider]: id } };
  await AsyncStorage.setItem(INDEX, JSON.stringify(next));
  return next;
});

export const deleteApiKey = id => serialize(async () => {
  const index = await readIndex();
  const entry = index.keys.find(key => key.id === id);
  if (!entry) return index;
  const next = { keys: index.keys.filter(key => key.id !== id), active: { ...index.active } };
  if (next.active[entry.provider] === id) next.active[entry.provider] = next.keys.find(key => key.provider === entry.provider)?.id || null;
  await AsyncStorage.setItem(INDEX, JSON.stringify(next));
  await removeSecret(secretName(id));
  if (id === 'legacy_gemini') await removeSecret(LEGACY);
  return next;
});
