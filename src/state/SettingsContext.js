import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import * as Localization from 'expo-localization';
import { DEFAULT_PUBLIC_MODEL_ID } from '../config/aiModels';
import { DEFAULT_MODELS, isAIProvider } from '../config/aiProviders';
import { resolveMacroGoals, validMacroGoals } from '../utils/macroGoals';

import { COLOR_THEMES, getPalette } from '../theme/palette';

const STORAGE_KEY = 'settings.v1';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [dailyGoal, setDailyGoal] = useState(2100);
  const [customMacroGoals, setCustomMacroGoals] = useState(null);
  const [aiModel, setAiModel] = useState(DEFAULT_PUBLIC_MODEL_ID);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [providerModels, setProviderModels] = useState({});
  const [claudeVoiceProvider, setClaudeVoiceProvider] = useState('none');

  const systemLang = Localization.getLocales()[0]?.languageCode;
  const supportedLangs = ['sk', 'en', 'de', 'es', 'fr', 'pl', 'cs', 'it'];
  const initialLang = supportedLangs.includes(systemLang) ? systemLang : 'en';

  const [language, setLanguage] = useState(initialLang);
  const [theme, setTheme] = useState('system');
  const [showLatestMeal, setShowLatestMeal] = useState(null);
  const [colorTheme, setColorTheme] = useState('original');
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
          if (validMacroGoals(parsed?.customMacroGoals)) setCustomMacroGoals(parsed.customMacroGoals);
          if (typeof parsed?.aiModel === 'string') {
            setAiModel(parsed.aiModel === 'gemini-flash-latest' ? DEFAULT_PUBLIC_MODEL_ID : parsed.aiModel);
          }
          if (isAIProvider(parsed?.aiProvider)) setAiProvider(parsed.aiProvider);
          if (parsed?.providerModels && typeof parsed.providerModels === 'object') {
            setProviderModels(Object.fromEntries(Object.entries(parsed.providerModels).filter(([id, model]) => isAIProvider(id) && typeof model === 'string' && model.trim())));
          }
          if (['none', 'gemini', 'openai'].includes(parsed?.claudeVoiceProvider)) setClaudeVoiceProvider(parsed.claudeVoiceProvider);
          if (typeof parsed?.language === 'string') setLanguage(parsed.language);
          if (typeof parsed?.showLatestMeal === 'boolean') setShowLatestMeal(parsed.showLatestMeal);
          if (COLOR_THEMES.includes(parsed?.colorTheme)) setColorTheme(parsed.colorTheme);
          if (typeof parsed?.theme === 'string') setTheme(parsed.theme);
          if (Array.isArray(parsed?.customModels)) setCustomModels(parsed.customModels);
          if (Array.isArray(parsed?.foodCategories)) setFoodCategories(parsed.foodCategories);
          if (typeof parsed?.saveFoodImages === 'boolean') setSaveFoodImages(parsed.saveFoodImages);
          if (typeof parsed?.showImagesInHistory === 'boolean') setShowImagesInHistory(parsed.showImagesInHistory);
          if (typeof parsed?.showUniqueHistorySearchResults === 'boolean') setShowUniqueHistorySearchResults(parsed.showUniqueHistorySearchResults);
          if (typeof parsed?.termsAccepted === 'boolean') setTermsAccepted(parsed.termsAccepted);
          if (typeof parsed?.autoSaveEnabled === 'boolean') setAutoSaveEnabled(parsed.autoSaveEnabled);
          if (Number.isFinite(parsed?.autoSaveSeconds)) setAutoSaveSeconds(parsed.autoSaveSeconds);
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
      JSON.stringify({ aiProvider, providerModels, claudeVoiceProvider, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds })
    ).catch(() => { });
  }, [aiProvider, providerModels, claudeVoiceProvider, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, hydrated]);

  const colorScheme = useColorScheme();

  const value = useMemo(() => {
    const effectiveTheme = theme === 'system' ? (colorScheme || 'dark') : theme;
    return {
      hydrated,
      dailyGoal,
      setDailyGoal,
      macroGoals: resolveMacroGoals(dailyGoal, customMacroGoals),
      customMacroGoals,
      setCustomMacroGoals,
      aiProvider,
      setAiProvider,
      claudeVoiceProvider,
      setClaudeVoiceProvider,
      aiModel: aiProvider === 'gemini' ? aiModel : (providerModels[aiProvider] || DEFAULT_MODELS[aiProvider]),
      setAiModel: model => aiProvider === 'gemini' ? setAiModel(model) : setProviderModels(previous => ({ ...previous, [aiProvider]: model })),
      language,
      setLanguage,
      theme: effectiveTheme, // Export resolved theme for UI consumption
      userTheme: theme,      // Export raw setting for SettingsPicker
      setTheme,
      colorTheme,
      setColorTheme,
      showLatestMeal,
      setShowLatestMeal,
      colors: getPalette(effectiveTheme, colorTheme),
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
    };
  }, [aiProvider, providerModels, claudeVoiceProvider, hydrated, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, colorScheme]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
