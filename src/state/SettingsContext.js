import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import * as Localization from 'expo-localization';
import { DEFAULT_PUBLIC_MODEL_ID } from '../config/aiModels';

const STORAGE_KEY = 'settings.v1';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [dailyGoal, setDailyGoal] = useState(2100);
  const [aiModel, setAiModel] = useState(DEFAULT_PUBLIC_MODEL_ID);

  const systemLang = Localization.getLocales()[0]?.languageCode;
  const supportedLangs = ['sk', 'en', 'de', 'es', 'fr', 'pl', 'cs', 'it'];
  const initialLang = supportedLangs.includes(systemLang) ? systemLang : 'en';

  const [language, setLanguage] = useState(initialLang);
  const [theme, setTheme] = useState('system');
  const [useLocalStorage, setUseLocalStorage] = useState(true);
  const [customModels, setCustomModels] = useState([]);
  const [foodCategories, setFoodCategories] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveFoodImages, setSaveFoodImages] = useState(true);
  const [showImagesInHistory, setShowImagesInHistory] = useState(true);
  const [showUniqueHistorySearchResults, setShowUniqueHistorySearchResults] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(10);
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (!cancelled) setHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw);
        if (!cancelled) {
          if (Number.isFinite(parsed?.dailyGoal)) setDailyGoal(parsed.dailyGoal);
          if (typeof parsed?.aiModel === 'string') setAiModel(parsed.aiModel);
          if (typeof parsed?.language === 'string') setLanguage(parsed.language);
          if (typeof parsed?.theme === 'string') setTheme(parsed.theme);
          if (Array.isArray(parsed?.customModels)) setCustomModels(parsed.customModels);
          if (Array.isArray(parsed?.foodCategories)) setFoodCategories(parsed.foodCategories);
          if (typeof parsed?.saveFoodImages === 'boolean') setSaveFoodImages(parsed.saveFoodImages);
          if (typeof parsed?.showImagesInHistory === 'boolean') setShowImagesInHistory(parsed.showImagesInHistory);
          if (typeof parsed?.showUniqueHistorySearchResults === 'boolean') setShowUniqueHistorySearchResults(parsed.showUniqueHistorySearchResults);
          if (typeof parsed?.termsAccepted === 'boolean') setTermsAccepted(parsed.termsAccepted);
          if (typeof parsed?.autoSaveEnabled === 'boolean') setAutoSaveEnabled(parsed.autoSaveEnabled);
          if (Number.isFinite(parsed?.autoSaveSeconds)) setAutoSaveSeconds(parsed.autoSaveSeconds);
          if (typeof parsed?.healthConnectEnabled === 'boolean') setHealthConnectEnabled(parsed.healthConnectEnabled);
          // Enforce local storage for this version
          setUseLocalStorage(true);
          setHydrated(true);
        }
      } catch {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dailyGoal, aiModel, language, theme, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled })
    ).catch(() => { });
  }, [dailyGoal, aiModel, language, theme, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled, hydrated]);

  const colorScheme = useColorScheme();

  const value = useMemo(() => {
    const effectiveTheme = theme === 'system' ? (colorScheme || 'dark') : theme;
    return {
      hydrated,
      dailyGoal,
      setDailyGoal,
      aiModel,
      setAiModel,
      language,
      setLanguage,
      theme: effectiveTheme, // Export resolved theme for UI consumption
      userTheme: theme,      // Export raw setting for SettingsPicker
      setTheme,
      useLocalStorage,
      setUseLocalStorage,
      customModels,
      setCustomModels,
      foodCategories,
      setFoodCategories,
      saveFoodImages,
      setSaveFoodImages,
      showImagesInHistory,
      setShowImagesInHistory,
      showUniqueHistorySearchResults,
      setShowUniqueHistorySearchResults,
      termsAccepted,
      setTermsAccepted,
      autoSaveEnabled,
      setAutoSaveEnabled,
      autoSaveSeconds,
      setAutoSaveSeconds,
      healthConnectEnabled,
      setHealthConnectEnabled,
    };
  }, [hydrated, dailyGoal, aiModel, language, theme, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled, colorScheme]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
