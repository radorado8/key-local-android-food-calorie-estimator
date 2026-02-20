export const ADMIN_EMAIL = 'radkoradko@gmail.com';

// Central catalog of supported models. Add/remove here.
export const MODEL_CATALOG = [
  {
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (Latest)',
    descriptionKey: 'modelDesc_flashLiteLatest',
  },
  {
    id: 'gemini-flash-lite',
    label: 'Gemini Flash Lite',
    descriptionKey: 'modelDesc_flashLite',
  },
  {
    id: 'gemini-flash',
    label: 'Gemini Flash',
    descriptionKey: 'modelDesc_flash',
  },
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash (Latest)',
    descriptionKey: 'modelDesc_flashLatest',
  },
  {
    id: 'gemini-pro',
    label: 'Gemini Pro',
    descriptionKey: 'modelDesc_pro',
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
  'gemini-flash-lite',
  'gemini-flash',
  'gemini-flash-latest',
  'gemini-pro',
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
