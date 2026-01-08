import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigation } from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import ScannerScreen from './src/screens/ScannerScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';
import { useTranslation } from './src/hooks/useTranslation';
import * as NavigationBar from 'expo-navigation-bar';

enableScreens(true);

const Tab = createBottomTabNavigator();

export default function App() {
  const [startupError, setStartupError] = useState(null);

  useEffect(() => {
    const errorUtils = globalThis?.ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;

    const previousHandler = typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : null;

    errorUtils.setGlobalHandler((error, isFatal) => {
      try {
        const msg = String(error?.stack || error?.message || error);
        console.error('Fatal JS error', { isFatal, msg });
        setStartupError(msg);
      } catch {
        setStartupError('Startup fatal error (unknown).');
      }
    });

    return () => {
      if (previousHandler) {
        errorUtils.setGlobalHandler(previousHandler);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppContent startupError={startupError} />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}


import * as QuickActions from 'expo-quick-actions';

// Fallback if the library is missing or mocking fails
const useQuickAction = QuickActions.useQuickAction || (() => null);
function QuickActionHandler() {
  const navigation = useNavigation();
  const action = useQuickAction();

  useEffect(() => {
    if (action && action.params) {
      // Navigate to Scanner with params
      // We use a small timeout to ensure navigation is ready/mounted if cold start
      setTimeout(() => {
        navigation.navigate('Scanner', {
          action: action.params.action,
          timestamp: Date.now() // Force update if same action
        });
      }, 500);
    }
  }, [action, navigation]);

  return null;
}

function AppContent({ startupError }) {
  const insets = useSafeAreaInsets();
  const { theme } = useSettings();
  const t = useTranslation();

  // Configure Quick Actions
  useEffect(() => {
    if (QuickActions.setItems) {
      QuickActions.setItems([
        {
          title: t.shortcutAddFood || 'Add Food (Photo)',
          subtitle: t.scannerTitle,
          icon: Platform.OS === 'ios' ? 'symbol:camera' : 'camera',
          id: 'add_food_camera',
          params: { action: 'camera' },
        },
        {
          title: t.shortcutAddFoodWeight || 'Add Food (Weight)',
          subtitle: t.scannerTitle,
          icon: Platform.OS === 'ios' ? 'symbol:scalemass' : 'add', // "add" is a common android drawable name
          id: 'add_food_weight',
          params: { action: 'camera_weight' },
        }
      ]);
    }
  }, [t]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const navColor = theme === 'light' ? '#FFFFFF' : '#0B0F14';
      const iconStyle = theme === 'light' ? 'dark' : 'light';
      NavigationBar.setBackgroundColorAsync(navColor).catch(() => { });
      NavigationBar.setButtonStyleAsync(iconStyle).catch(() => { });
    }
  }, [theme]);

  const colors = theme === 'light'
    ? {
      bg: '#F8FAFC',
      tabBg: '#FFFFFF',
      tabBorder: 'rgba(0,0,0,0.06)',
      active: '#0D9488',
      inactive: '#64748B'
    }
    : {
      bg: '#0B0F14',
      tabBg: '#0B0F14',
      tabBorder: 'rgba(255,255,255,0.12)',
      active: '#2DD4BF',
      inactive: 'rgba(255,255,255,0.6)'
    };

  return (
    <NavigationContainer>
      <QuickActionHandler />
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Scanner') {
              iconName = focused ? 'camera' : 'camera-outline';
            } else if (route.name === 'History') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarStyle: {
            backgroundColor: colors.tabBg,
            borderTopColor: colors.tabBorder,
            height: 60 + (Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom),
            paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom,
          },
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarLabelStyle: {
            fontWeight: '700',
            fontSize: 11,
            marginTop: -4,
          },
        })}
      >
        <Tab.Screen name="Scanner" component={ScannerScreen} options={{ title: t.tabScanner }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ title: t.tabHistory }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.tabSettings }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
