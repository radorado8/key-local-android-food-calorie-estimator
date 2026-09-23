import usdaCommonFoods from '../data/usdaCommonFoods.json';

const signature = (name, food) => JSON.stringify([
  name, ...['calories', 'protein', 'carbs', 'fat', 'weight_g'].map(key => Number(food[key])),
]);

// Older imports did not retain source IDs. Match the old AI-generated label
// and complete food signature, even in renamed libraries or moved items.
const replacements = new Map();
for (const food of usdaCommonFoods.favorites) {
  const key = signature(food.legacySkName.slice(0, 100), food);
  if (replacements.has(key) && replacements.get(key) !== food.names.sk) {
    replacements.set(key, null);
  } else if (!replacements.has(key)) {
    replacements.set(key, food.names.sk);
  }
}

export function upgradeUsdaFavoriteNames(favorites) {
  return favorites.map(food => {
    const name = replacements.get(signature(food.name, food));
    return name && name !== food.name ? { ...food, name } : food;
  });
}
