// Display meal timestamps in the device's local time, without seconds.
export function mealDateTime(meal) {
  const raw = meal?.dateObj || meal?.timestamp;
  if (raw == null) return '';
  const date = raw?.toDate ? raw.toDate() : raw?.seconds != null
    ? new Date(raw.seconds * 1000) : new Date(raw);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = value => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
