// Use the measured app bounds rather than the full display (foldable/windowed apps).
export function splitDashboardLayout(width, height, nativeFrame = null) {
  const split = width >= 840 && height >= 520 && width > height;
  // The safe content rectangle excludes the native rail. Its midpoint is not
  // the display midpoint: the rail belongs to the half on which it is placed.
  const center = nativeFrame && Number.isFinite(nativeFrame.windowWidth) && nativeFrame.windowWidth > 0
    && Number.isFinite(nativeFrame.contentLeft)
    ? nativeFrame.windowWidth / 2 - nativeFrame.contentLeft - .5 : null;
  if (!split) return { split, left: width };
  const left = center == null ? Math.round(width * .48) : Math.max(1, Math.min(width - 2, center));
  // On native iOS rails, keep Home next to the rail. The other pane gets
  // the full physical half, while Home shares its half with system navigation.
  const rightInset = nativeFrame ? nativeFrame.windowWidth - nativeFrame.contentLeft - width : 0;
  const homeOnRight = !!nativeFrame && rightInset > nativeFrame.contentLeft;
  const homeWidth = homeOnRight ? width - left - 1 : left;
  return { split, left, homeOnRight, homeWidth, detailWidth: width - homeWidth - 1 };
}
