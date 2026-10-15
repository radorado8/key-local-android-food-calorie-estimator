export const MEAL_TYPES = [
  { id: 'breakfast', labelKey: 'catBreakfast' },
  { id: 'snack1', labelKey: 'catSnack1' },
  { id: 'lunch', labelKey: 'catLunch' },
  { id: 'snack2', labelKey: 'catSnack2' },
  { id: 'dinner', labelKey: 'catDinner' },
  { id: 'snack3', labelKey: 'catSnack3' },
];

// Preserve the historical grouping when no custom schedule has been saved.
export const DEFAULT_MEAL_STARTS = { breakfast: 60, snack1: 600, lunch: 660, snack2: 840, dinner: 960, snack3: 1320 };

export function validMealStarts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return MEAL_TYPES.every(({ id }, index) => Number.isInteger(value[id]) && value[id] >= 0 && value[id] < 1440
    && (index === 0 || value[id] > value[MEAL_TYPES[index - 1].id]));
}

export function mealTypeAt(date, starts = DEFAULT_MEAL_STARTS) {
  const schedule = validMealStarts(starts) ? starts : DEFAULT_MEAL_STARTS;
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (let i = MEAL_TYPES.length - 1; i >= 0; i--) {
    if (minutes >= schedule[MEAL_TYPES[i].id]) return MEAL_TYPES[i];
  }
  return MEAL_TYPES[MEAL_TYPES.length - 1];
}

export function formatMealStart(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parseMealStart(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
