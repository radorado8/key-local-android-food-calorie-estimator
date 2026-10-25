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
  openai: [
    ...[['gpt-6.1-sol', 'GPT-6.1 Sol'], ['gpt-6-luna', 'GPT-6 Luna'], ['gpt-6-sol', 'GPT-6 Sol'], ['gpt-5.6-terra', 'GPT-5.6 Terra'], ['gpt-5.6-luna', 'GPT-5.6 Luna'], ['gpt-5.4-mini', 'GPT-5.4 mini'], ['gpt-5.4-nano', 'GPT-5.4 nano'], ['gpt-5-mini', 'GPT-5 mini'], ['gpt-5-nano', 'GPT-5 nano']].map(([id, label]) => ({ id, label })),
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }, { id: 'gpt-4.1', label: 'GPT-4.1' }],
  claude: [
    ...[['claude-haiku-5-5', 'Claude Haiku 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-fable-5-1', 'Claude Fable 5.1']].map(([id, label]) => ({ id, label })),
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }, { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' }],
};
export const isAIProvider = id => AI_PROVIDERS.some(provider => provider.id === id);
export const modelProvider = model => model.provider || 'gemini';

// Standard API rates in USD per million tokens, verified 2026-10-24.
// Labels are indicative; billing, images and thinking tokens depend on the provider.
export const MODEL_COST_INFO = {
  'gpt-6-luna': { recommended: true, price: '$0.10 / $0.50' },
  'gpt-6.1-sol': { expensive: true, price: '$2 / $10' },
  'gemini-3.5-flash-lite': { recommended: true, price: '$0.30 / $2.50' },
  'gemini-4-argon': { expensive: true, price: '$2 / $10 → $4 / $20 (2026-12-01)' },
  'gemini-3.1-pro-preview': { expensive: true },
  'gemini-pro-latest': { expensive: true },
  'claude-haiku-5-5': { recommended: true, price: '$0.10 / $0.50 (≤100k)' },
  'claude-sonnet-5-5': { expensive: true, price: '$2 / $10' },
  'claude-opus-5-5': { expensive: true, price: '$4 / $20' },
  'claude-fable-5-1': { expensive: true, price: '$10 / $50' },
  'claude-haiku-4-5': { price: '$1 / $5' },
  'claude-sonnet-4-6': { expensive: true, price: '$3 / $15' },
};
