// Calendar dates are advanced locally, so daylight-saving days remain intact.
export function analyticsMaxOffset(mode, earliest, now = new Date()) {
  if (mode === 'year') return 0;
  if (!earliest || !Number.isFinite(earliest.getTime())) return 0;
  if (mode === 'month') return Math.max(0, (now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth());
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  return Math.max(0, Math.floor((dayNumber(now) - dayNumber(earliest)) / (mode === 'fortnight' ? 14 : 7)));
}

export function analyticsPeriod(mode, offset = 0, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end;
  if (mode === 'year') {
    start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    end = new Date(today);
  } else if (mode === 'month') {
    start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    end = offset === 0 ? new Date(today) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
  } else {
    const length = mode === 'fortnight' ? 14 : 7;
    end = new Date(today); end.setDate(end.getDate() - offset * length);
    start = new Date(end); start.setDate(start.getDate() - length + 1);
  }
  const dates = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
  return { start, end, dates };
}
