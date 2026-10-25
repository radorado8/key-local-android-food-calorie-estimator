import React, { useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createNavigatorFactory, TabRouter, useNavigationBuilder } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../state/SettingsContext';
import { splitDashboardLayout } from '../utils/splitDashboardLayout';
import NativeTabRail from './NativeTabRail';
import { usesNativeTabRail } from './nativeTabPolicy';
import { isIOSAppOnMac } from '../utils/platformEnvironment';
import { PaneWidthContext, PaneVisibleContext } from './PaneWidthContext';

function AdaptiveTabNavigator({ children, screenOptions, initialRouteName, ...rest }) {
  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    children, screenOptions, initialRouteName, ...rest,
  });
  const { colors } = useSettings();
  const windowInsets = useSafeAreaInsets();
  const nativeTabs = usesNativeTabRail(Platform, isIOSAppOnMac);
  // NativeTabRail already measures a rectangle inside all system bars on iOS.
  const insets = nativeTabs ? { left: 0, right: 0, top: 0, bottom: 0 } : windowInsets;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const availableWidth = Math.max(0, size.width - insets.left - insets.right);
  const [nativeFrame, setNativeFrame] = useState(null);
  const layout = splitDashboardLayout(availableWidth, size.height, nativeFrame);
  // Foldable windows are wider and shorter than ordinary portrait phones,
  // including when the outer display is used. Keep their navigation compact.
  const compact = layout.split || (size.width >= 440 && size.height > 0 && size.height <= 800);
  const tabHeight = compact ? 36 : 60;
  const scanner = state.routes.find(route => route.name === 'Scanner');
  const details = state.routes.filter(route => route.name !== 'Scanner');
  const focused = state.routes[state.index];
  const wasSplit = useRef(false);
  const foldingClosed = wasSplit.current && !layout.split;
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    const closed = wasSplit.current && !layout.split;
    wasSplit.current = layout.split;
    if (closed) navigation.navigate('Scanner');
  }, [layout.split, size.width, size.height, navigation]);
  const lastDetail = useRef('History');
  if (focused.name !== 'Scanner') lastDetail.current = focused.name;
  const detail = details.find(route => route.name === lastDetail.current) || details[0];
  const loaded = useRef(new Set());
  loaded.current.add(focused.key);
  if (layout.split) { loaded.current.add(scanner.key); loaded.current.add(detail.key); }
  const showScanner = layout.split || foldingClosed || focused.name === 'Scanner';
  const showDetails = layout.split || (!foldingClosed && focused.name !== 'Scanner');
  const activeOptions = descriptors[focused.key].options;
  const hideBar = !layout.split && StyleSheet.flatten(activeOptions.tabBarStyle)?.display === 'none';
  const bottom = Platform.OS === 'android' ? Math.max(insets.bottom, 10) : compact ? Math.min(insets.bottom, 16) : insets.bottom;
  const tab = route => {
    const options = descriptors[route.key].options;
    const selected = layout.split ? route.name === 'Scanner' || route.key === detail.key : route.key === focused.key;
    const color = selected ? colors.active : colors.inactive;
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.title || route.name}
      accessibilityState={{ selected }}
      onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!event.defaultPrevented) navigation.navigate(route.name);
      }}
      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, height: tabHeight, flexDirection: layout.split ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: layout.split ? 5 : compact ? 0 : 3, opacity: pressed ? .6 : 1 })}>
      {options.tabBarIcon?.({ focused: selected, color, size: compact ? 18 : 25 })}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={{ color, flexShrink: 1, fontSize: compact ? 10 : 11, fontWeight: '700', textAlign: 'center', paddingHorizontal: 3 }}>{options.title || route.name}</Text>
    </Pressable>;
  };
  const content = <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }}>
      <View style={{ flex: 1, minWidth: 1, minHeight: 1, overflow: 'hidden', flexDirection: layout.homeOnRight ? 'row-reverse' : 'row', paddingLeft: insets.left, paddingRight: insets.right }}>
        {/* Keep inactive SVG screens laid out: display:none gives their native
            viewBox a zero-sized viewport while a fold transition is drawing. */}
        <View pointerEvents={showScanner ? 'auto' : 'none'} accessibilityElementsHidden={!showScanner} importantForAccessibility={showScanner ? 'auto' : 'no-hide-descendants'}
          style={[{ minWidth: 1, minHeight: 1, width: Math.max(1, layout.split ? layout.homeWidth : availableWidth) }, !showScanner && { position: 'absolute', top: 0, bottom: 0, left: insets.left, opacity: 0, zIndex: -1 }]}>
          <PaneWidthContext.Provider value={layout.split ? layout.homeWidth : availableWidth}><SafeAreaProvider style={{ flex: 1, minWidth: 1, minHeight: 1 }}>{loaded.current.has(scanner.key) && descriptors[scanner.key].render()}</SafeAreaProvider></PaneWidthContext.Provider>
        </View>
        <View pointerEvents={showDetails ? 'auto' : 'none'} accessibilityElementsHidden={!showDetails} importantForAccessibility={showDetails ? 'auto' : 'no-hide-descendants'}
          style={[{ flex: 1, minWidth: 1, minHeight: 1, borderLeftWidth: layout.split && !layout.homeOnRight ? 1 : 0, borderRightWidth: layout.split && layout.homeOnRight ? 1 : 0, borderLeftColor: colors.border, borderRightColor: colors.border }, !showDetails && { position: 'absolute', top: 0, bottom: 0, left: insets.left, right: insets.right, opacity: 0, zIndex: -1 }]}>
          <PaneWidthContext.Provider value={layout.split ? layout.detailWidth : availableWidth}><SafeAreaProvider style={{ flex: 1, minWidth: 1, minHeight: 1 }}>
            {details.map(route => {
              if (!loaded.current.has(route.key)) return null;
              const visible = (layout.split ? detail.key : focused.key) === route.key;
              return <View key={route.key} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
                style={[{ flex: 1, minWidth: 1, minHeight: 1 }, !visible && { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0, zIndex: -1 }]}><PaneVisibleContext.Provider value={showDetails && visible}>{descriptors[route.key].render()}</PaneVisibleContext.Provider></View>;
            })}
          </SafeAreaProvider></PaneWidthContext.Provider>
        </View>
      </View>
      {!nativeTabs && !hideBar && <View style={{ flexShrink: 0, backgroundColor: colors.tabBg, borderTopWidth: 1, borderTopColor: colors.tabBorder, paddingBottom: bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
        {layout.split ? <View style={{ flexDirection: 'row' }}>
          <View style={{ width: layout.left, alignItems: 'center' }}><View style={{ width: 96, height: tabHeight }}>{tab(scanner)}</View></View>
          <View style={{ flex: 1, flexDirection: 'row', borderLeftWidth: 1, borderLeftColor: colors.border }}>{details.map(tab)}</View>
        </View> : <View style={{ alignSelf: 'center', width: '100%', maxWidth: 600, flexDirection: 'row' }}>{state.routes.map(tab)}</View>}
      </View>}
    </View>;
  return <NavigationContent>{nativeTabs
    ? <NativeTabRail state={state} navigation={navigation} descriptors={descriptors} hidden={hideBar} split={layout.split} detailKey={detail.key} onGeometry={setNativeFrame}>{content}</NativeTabRail>
    : content}</NavigationContent>;
}

export const createAdaptiveTabNavigator = createNavigatorFactory(AdaptiveTabNavigator);
