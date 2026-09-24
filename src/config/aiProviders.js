import { MODEL_CATALOG, DEFAULT_PUBLIC_MODEL_ID } from './aiModels';

export const AI_PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude' },
];
export const DEFAULT_MODELS = {
  gemini: DEFAULT_PUBLIC_MODEL_ID,
  openai: 'gpt-4.1-mini',
  claude: 'claude-haiku-4-5',
};
export const PROVIDER_MODELS = {
  gemini: MODEL_CATALOG,
  openai: [{ id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }, { id: 'gpt-4.1', label: 'GPT-4.1' }],
  claude: [{ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }, { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' }],
};
export const isAIProvider = id => AI_PROVIDERS.some(provider => provider.id === id);
export const modelProvider = model => model.provider || 'gemini';
