export function mealTimestamp(meal) {
  // In-memory records and restored backups may use different timestamp shapes.
  for (const raw of [meal?.dateObj, meal?.timestamp]) {
    if (raw == null) continue;
    const date = raw?.toDate ? raw.toDate() : raw?.seconds != null
      ? new Date(raw.seconds * 1000) : new Date(raw);
    const time = date.getTime();
    if (Number.isFinite(time)) return time;
  }
  return null;
}

// Imports and edits can leave storage in a different order from meal timestamps.
export function getLatestMeal(meals) {
  let latest = null;
  let latestTime = -Infinity;
  for (const meal of meals || []) {
    const time = mealTimestamp(meal);
    if (time !== null && time > latestTime) {
      latest = meal;
      latestTime = time;
    }
  }
  return latest;
}
