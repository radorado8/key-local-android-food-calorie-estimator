// Advance local dates rather than milliseconds, including across DST changes.
const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

export function analyticsMaxOffset(mode, earliest, now = new Date(), options = {}) {
  if (!earliest || !Number.isFinite(earliest.getTime())) return 0;
  if (mode === 'year') return options.rangeMode === 'absolute' ? Math.max(0, now.getFullYear() - earliest.getFullYear()) : 0;
  const current = analyticsPeriod(mode, 0, now, options);
  if (dayNumber(earliest) >= dayNumber(current.start)) return 0;
  if (mode === 'month' && options.rangeMode !== 'rolling') {
    return Math.max(0, (now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth());
  }
  const length = mode === 'month' ? 30 : mode === 'fortnight' ? 14 : 7;
  return Math.max(0, Math.ceil((dayNumber(current.start) - dayNumber(earliest)) / length));
}

export function analyticsPeriod(mode, offset = 0, now = new Date(), options = {}) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const absolute = (options.rangeMode || (mode === 'month' ? 'absolute' : 'rolling')) === 'absolute';
  let start, end;
  if (mode === 'year') {
    start = absolute ? new Date(today.getFullYear() - offset, 0, 1) : new Date(today.getFullYear(), today.getMonth() - 11, 1);
    end = absolute ? new Date(today.getFullYear() - offset, 11, 31) : new Date(today);
  } else if (mode === 'month' && absolute) {
    start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  } else {
    const length = mode === 'month' ? 30 : mode === 'fortnight' ? 14 : 7;
    if (absolute) {
      const weekStart = options.weekStart === 'sunday' ? 0 : 1;
      start = new Date(today);
      start.setDate(start.getDate() - (start.getDay() - weekStart + 7) % 7 - (mode === 'fortnight' ? 7 : 0) - offset * length);
      end = new Date(start); end.setDate(end.getDate() + length - 1);
    } else {
      end = new Date(today); end.setDate(end.getDate() - offset * length);
      start = new Date(end); start.setDate(start.getDate() - length + 1);
    }
  }
  const dates = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
  return { start, end, dates };
}
