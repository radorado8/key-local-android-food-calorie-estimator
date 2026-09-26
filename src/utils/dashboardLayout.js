const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function minimumButtonHeights(fontScale = 1) {
  const scale = Math.max(1, Number(fontScale) || 1);
  return {
    text: Math.max(48, 34 * scale + 14),
    actions: Math.max(64, 48 * scale + 12),
  };
}

export function dashboardContentFits(viewport, fixedContent, hasLatestMeal, fontScale = 1) {
  const { text, actions } = minimumButtonHeights(fontScale);
  const gaps = (hasLatestMeal ? 3 : 2) * 10;
  return viewport >= fixedContent + 32 + gaps + text + actions;
}

export function dashboardButtonHeights(viewport, fixedContent, hasLatestMeal, fontScale = 1) {
  const { text: textMin, actions: actionMin } = minimumButtonHeights(fontScale);
  // Voice and text should make use of spare vertical space, while remaining
  // visually lighter than the primary photo actions below.
  const textMax = Math.max(168, textMin);
  const actionMax = Math.max(116, actionMin);
  const gaps = (hasLatestMeal ? 3 : 2) * 10;
  const available = Math.max(0, viewport - fixedContent - 32 - gaps);
  const extra = Math.max(0, available - textMin - actionMin);
  const text = clamp(textMin + extra * 0.2, textMin, textMax);
  const actions = clamp(actionMin + Math.max(0, extra - (text - textMin)), actionMin, actionMax);
  return { text, actions };
}

export function latestMealFitsInitially(viewport, summaryHeight, fontScale = 1) {
  const estimatedBar = Math.max(88, 100 * Math.max(1, Number(fontScale) || 1));
  const fixedContent = summaryHeight + estimatedBar;
  return dashboardContentFits(viewport, fixedContent, true, fontScale);
}
