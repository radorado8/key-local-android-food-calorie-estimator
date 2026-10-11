// Keep identity, chosen date, category and photo while replacing AI nutrition.
export function reanalyzedMealPatch(draft, result) {
  const patch = { ...draft, name: String(result.name || draft.name).trim() };
  for (const field of ['calories', 'protein', 'carbs', 'fat', 'weight_g']) {
    const value = Number(result[field]);
    if (result[field] === null || result[field] === undefined || !Number.isFinite(value) || value < 0) throw new Error('Invalid nutrition analysis');
    patch[field] = field === 'weight_g' ? value : Math.round(value);
  }
  patch.confidence = Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : 0.5;
  return patch;
}
