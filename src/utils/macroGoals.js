// Adjustable starting split: 20% protein, 50% carbohydrate, 30% fat.
// Energy factors: https://www.nal.usda.gov/programs/fnic (4 / 4 / 9 kcal per g).
export const MACRO_COLORS = { protein: '#8B5CF6', carbs: '#0EA5E9', fat: '#F59E0B' };
export const MACRO_KEYS = ['protein', 'carbs', 'fat'];
export function validMacroGoals(value) {
  return value && MACRO_KEYS.every(key => Number.isFinite(value[key]) && value[key] > 0 && value[key] <= 2500);
}
export function resolveMacroGoals(calories, custom) {
  if (validMacroGoals(custom)) return custom;
  const kcal = Number.isFinite(calories) && calories > 0 ? calories : 2100;
  return { protein: Math.round(kcal * 0.2 / 4), carbs: Math.round(kcal * 0.5 / 4), fat: Math.round(kcal * 0.3 / 9) };
}
