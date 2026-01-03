export const ADMIN_EMAIL = 'radkoradko@gmail.com';

// Central catalog of supported models. Add/remove here.
export const MODEL_CATALOG = [
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    descriptionKey: 'modelDesc_gemini25flashlite',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    descriptionKey: 'modelDesc_gemini25flash',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3.0 Flash Preview',
    descriptionKey: 'modelDesc_gemini3FlashPreview',
  },
];

// Models available to non-admin users.
export const PUBLIC_MODEL_IDS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
];

export const DEFAULT_PUBLIC_MODEL_ID = 'gemini-3-flash-preview';
export const DEFAULT_ADMIN_MODEL_ID = 'gemini-3-flash-preview';

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
