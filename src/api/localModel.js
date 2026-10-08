import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, loadLlamaModelInfo } from 'llama.rn';
import { foodPrompt, foodResultSchema, parseFoodResult } from './foodResult';

const KEY = 'local-food-model.v1';
const directory = () => FileSystem.documentDirectory + 'local_models/';
let running = false;
const abort = signal => { if (signal?.aborted) { const error = new Error('Aborted'); error.name = 'AbortError'; throw error; } };

export async function getLocalModel() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  const saved = JSON.parse(raw);
  // Resolve relative filenames so an iOS application-container move preserves models.
  return { ...saved, model: saved.model && directory() + saved.model, projector: saved.projector && directory() + saved.projector };
}

export async function importLocalModel(asset, projector = false) {
  if (running) throw new Error('local_model_busy');
  running = true;
  let destination;
  try {
    if (!asset.name?.toLowerCase().endsWith('.gguf')) throw new Error('local_model_gguf_required');
    await FileSystem.makeDirectoryAsync(directory(), { intermediates: true });
    const filename = `${projector ? 'projector' : 'model'}-${Date.now()}.gguf`;
    destination = directory() + filename;
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    const info = await loadLlamaModelInfo(destination);
    if (!info?.['general.architecture']) throw new Error('local_model_invalid');
    const raw = await AsyncStorage.getItem(KEY);
    const previous = raw ? JSON.parse(raw) : {};
    const field = projector ? 'projector' : 'model';
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...previous, [field]: filename, [field + 'Name']: asset.name }));
    destination = null;
    if (previous[field]) await FileSystem.deleteAsync(directory() + previous[field], { idempotent: true }).catch(() => {});
    return getLocalModel();
  } finally {
    if (destination) await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
    running = false;
  }
}

export async function deleteLocalModel() {
  if (running) throw new Error('local_model_busy');
  running = true;
  try {
    await AsyncStorage.removeItem(KEY);
    await FileSystem.deleteAsync(directory(), { idempotent: true });
  } finally { running = false; }
}

export async function analyzeLocally(payload) {
  abort(payload.signal);
  if (payload.audioUri || payload.audioBase64) throw new Error('local_voice_unavailable');
  if (running) throw new Error('local_model_busy');
  running = true;
  let context;
  const stop = () => { context?.stopCompletion().catch(() => {}); };
  try {
    const files = await getLocalModel();
    if (!files.model || !(await FileSystem.getInfoAsync(files.model)).exists) throw new Error('local_model_missing');
    if (payload.base64Data && (!files.projector || !(await FileSystem.getInfoAsync(files.projector)).exists)) throw new Error('local_projector_missing');
    abort(payload.signal);
    context = await initLlama({ model: files.model, n_ctx: 4096, n_batch: 128, n_gpu_layers: 0, ctx_shift: false, use_mlock: false });
    abort(payload.signal);
    if (payload.base64Data) {
      const initialized = await context.initMultimodal({ path: files.projector, use_gpu: false });
      if (!initialized || !(await context.getMultimodalSupport()).vision) throw new Error('local_vision_unavailable');
    }
    abort(payload.signal);
    payload.signal?.addEventListener('abort', stop);
    const prompt = foodPrompt(payload);
    const content = payload.base64Data ? [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:${payload.mimeType || 'image/jpeg'};base64,${payload.base64Data}` } },
    ] : prompt;
    const result = await context.completion({ messages: [{ role: 'user', content }],
      jinja: false, response_format: { type: 'json_schema', json_schema: { schema: foodResultSchema } }, enable_thinking: false, temperature: 0.1, n_predict: 512 });
    abort(payload.signal);
    return parseFoodResult(result.text);
  } finally {
    payload.signal?.removeEventListener('abort', stop);
    try { if (context) await context.release(); } finally { running = false; }
  }
}
