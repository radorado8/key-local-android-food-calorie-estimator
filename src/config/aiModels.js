export const ADMIN_EMAIL = 'radkoradko@gmail.com';

// Central catalog of supported models. Add/remove here.
export const MODEL_CATALOG = [
  {
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (Latest)',
    descriptionKey: 'modelDesc_flashLiteLatest',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    descriptionKey: 'modelDesc_25flashLite',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    descriptionKey: 'modelDesc_25flash',
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
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    descriptionKey: 'modelDesc_25pro',
  },
  {
    id: 'gemini-pro-latest',
    label: 'Gemini Pro (Latest)',
    descriptionKey: 'modelDesc_proLatest',
  },
];

// Models available to non-admin users.
export const PUBLIC_MODEL_IDS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-pro-latest',
];

export const DEFAULT_PUBLIC_MODEL_ID = 'gemini-flash-latest';
export const DEFAULT_ADMIN_MODEL_ID = 'gemini-flash-latest';

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
