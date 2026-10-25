export const ADMIN_EMAIL = 'radkoradko@gmail.com';

// Central catalog of supported models. Add/remove here.
// Verified against https://ai.google.dev/gemini-api/docs/models (2026-10-24).
export const CURRENT_GEMINI_MODELS = [
  ['gemini-4-argon', 'Gemini 4 Argon'],
  ['gemini-3.8-flash', 'Gemini 3.8 Flash'],
  ['gemini-3.6-flash', 'Gemini 3.6 Flash'],
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite'],
  ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite'],
  ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro (Preview)'],
].map(([id, label]) => ({ id, label }));
export const MODEL_CATALOG = [
  ...CURRENT_GEMINI_MODELS,
  {
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (Latest)',
    descriptionKey: 'modelDesc_flashLiteLatest',
  },
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash (Latest)',
    descriptionKey: 'modelDesc_flashLatest',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
    descriptionKey: 'modelDesc_3flashPreview',
  },
  {
    id: 'gemini-pro-latest',
    label: 'Gemini Pro (Latest)',
    descriptionKey: 'modelDesc_proLatest',
  },
];

// Models available to non-admin users.
export const PUBLIC_MODEL_IDS = [
  ...CURRENT_GEMINI_MODELS.map(model => model.id),
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-pro-latest',
];

export const DEFAULT_PUBLIC_MODEL_ID = 'gemini-3.5-flash-lite';
export const DEFAULT_ADMIN_MODEL_ID = 'gemini-3.5-flash-lite';

export function isAdminEmail(email) {
  return String(email || '').toLowerCase() === ADMIN_EMAIL;
}

export function getAvailableModelIds(email) {
  return isAdminEmail(email) ? MODEL_CATALOG.map((m) => m.id) : PUBLIC_MODEL_IDS.slice();
}

export function getAvailableModels(email) {
  const allowed = new Set(getAvailableModelIds(email));
  return MODEL_CATALOG.filter((m) => allowed.has(m.id));
}

export function coerceModelId(email, desiredModelId) {
  const allowedIds = getAvailableModelIds(email);
  if (allowedIds.includes(desiredModelId)) return desiredModelId;
  return isAdminEmail(email) ? DEFAULT_ADMIN_MODEL_ID : DEFAULT_PUBLIC_MODEL_ID;
}
