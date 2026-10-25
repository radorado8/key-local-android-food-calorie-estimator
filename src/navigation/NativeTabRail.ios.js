import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Tabs } from 'react-native-screens';
import { applyNativeTabSelection, nativeContentFrame, nativeTabRoutes } from './nativeTabState';
import { useSettings } from '../state/SettingsContext';

const symbols = { Scanner: 'house', History: 'list.bullet', Favorites: 'heart', Analytics: 'chart.bar', Settings: 'gearshape' };

// The native tab controller owns bar placement and camera avoidance. Its screens
// measure the content-safe rectangle; our persistent JS panes stay in one host,
// so changing native tabs or folding never remounts the dashboard or its dialogs.
function ContentBounds({ screenKey, activeKey, report, backgroundColor }) {
  const ref = useRef(null);
  const measure = useCallback(() => {
    if (screenKey !== activeKey) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) report(screenKey, { x, y, width, height });
    });
  }, [screenKey, activeKey, report]);
  React.useLayoutEffect(() => {
    measure();
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure]);
  return <SafeAreaProvider style={[styles.fill, { backgroundColor }]}>
    <SafeAreaView edges={['left', 'right', 'top', 'bottom']} style={styles.fill}>
      <View ref={ref} collapsable={false} style={styles.fill} onLayout={measure} />
    </SafeAreaView>
  </SafeAreaProvider>;
}

export default function NativeTabRail({ state, navigation, descriptors, hidden, split, detailKey, onGeometry, children }) {
  const { colors, theme } = useSettings();
  const root = useRef(null);
  const [frame, setFrame] = useState(null);
  const [provenance, setProvenance] = useState(0);
  const { routes, active } = nativeTabRoutes(state, split, detailKey);
  const [windowWidth, setWindowWidth] = useState(0);
  const activeRef = useRef(active.key);
  activeRef.current = active.key;
  const report = useCallback((key, bounds) => {
    if (key !== activeRef.current) return;
    root.current?.measureInWindow((x, y) => {
      if (key !== activeRef.current) return;
      const next = nativeContentFrame(bounds, { x, y });
      if (!next) return;
      setFrame(previous => previous && Object.keys(next).every(k => Math.abs(previous[k] - next[k]) < .5) ? previous : next);
    });
  }, []);
  React.useLayoutEffect(() => {
    if (windowWidth > 0 && frame) onGeometry({ windowWidth, contentLeft: frame.left });
  }, [windowWidth, frame?.left, onGeometry]);
  const select = event => {
    const { provenance: revision } = event.nativeEvent;
    setProvenance(revision);
    applyNativeTabSelection(state, navigation, event.nativeEvent);
  };
  return <View ref={root} collapsable={false} style={[styles.fill, { backgroundColor: colors.bg }]} onLayout={event => setWindowWidth(event.nativeEvent.layout.width)}>
    <Tabs.Host style={styles.fill} nativeContainerStyle={{ backgroundColor: colors.bg }} navStateRequest={{ selectedScreenKey: active.key, baseProvenance: provenance }}
      onTabSelected={select} tabBarHidden={hidden} colorScheme={theme === 'dark' ? 'dark' : 'light'}
      ios={{ tabBarControllerMode: 'tabBar', tabBarMinimizeBehavior: 'never', tabBarTintColor: colors.active }}>
      {routes.map(route => <Tabs.Screen key={route.key} screenKey={route.key} style={{ backgroundColor: colors.bg }} title={descriptors[route.key].options.title || route.name}
        ios={{ icon: { type: 'sfSymbol', name: symbols[route.name] || 'circle' }, standardAppearance: { tabBarBackgroundColor: colors.tabBg, stacked: { normal: { tabBarItemIconColor: colors.inactive, tabBarItemTitleFontColor: colors.inactive } } } }}>
        <ContentBounds screenKey={route.key} activeKey={active.key} report={report} backgroundColor={colors.bg} />
      </Tabs.Screen>)}
    </Tabs.Host>
    {frame && <View style={[styles.content, frame]}>
      <SafeAreaProvider style={styles.fill}>{children}</SafeAreaProvider>
    </View>}
  </View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minWidth: 1, minHeight: 1 }, content: { position: 'absolute', overflow: 'hidden' } });
