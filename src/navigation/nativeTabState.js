// A native controller also acknowledges JS requests. Do not turn those
// acknowledgements into presses or duplicate navigation (search/Quick Actions).
export function applyNativeTabSelection(state, navigation, event) {
  const route = state.routes.find(item => item.key === event.selectedScreenKey);
  if (!route || event.actionOrigin === 'programmatic-js') return;
  if (event.actionOrigin === 'user') {
    const pressed = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (pressed.defaultPrevented) return;
  }
  if (state.routes[state.index].key !== route.key) navigation.navigate(route.name);
}

export function nativeContentFrame(bounds, origin) {
  if (![bounds.x, bounds.y, bounds.width, bounds.height, origin.x, origin.y].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0) return null;
  return { left: bounds.x - origin.x, top: bounds.y - origin.y, width: bounds.width, height: bounds.height };
}

export function nativeTabRoutes(state, split, detailKey) {
  const routes = split ? state.routes.filter(route => route.name !== 'Scanner') : state.routes;
  const focused = state.routes[state.index];
  const active = routes.find(route => route.key === focused.key)
    || routes.find(route => route.key === detailKey) || routes[0];
  return { routes, active };
}
