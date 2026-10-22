// Use the measured app bounds rather than the full display (foldable/windowed apps).
export function splitDashboardLayout(width, height) {
  const split = width >= 840 && height >= 520 && width > height;
  return { split, left: split ? Math.round(width * .48) : width };
}
