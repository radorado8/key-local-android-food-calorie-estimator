// Imports and edits can leave storage in a different order from meal timestamps.
export function getLatestMeal(meals) {
  let latest = null;
  let latestTime = -Infinity;
  for (const meal of meals || []) {
    const time = new Date(meal.dateObj || meal.timestamp).getTime();
    if (Number.isFinite(time) && time > latestTime) {
      latest = meal;
      latestTime = time;
    }
  }
  return latest;
}
