import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, useColorScheme } from 'react-native';
import * as Localization from 'expo-localization';
import { DEFAULT_PUBLIC_MODEL_ID } from '../config/aiModels';
import { DEFAULT_MODELS, isAIProvider } from '../config/aiProviders';
import { resolveMacroGoals, validMacroGoals } from '../utils/macroGoals';

import { COLOR_THEMES, getPalette } from '../theme/palette';
import { calculateRestingProfile, estimateGarminExpenditure, estimateDailyExpenditure, localDateKey, rememberRestingEnergy, rememberDailyEnergyReading, resolveRestingBaseline, sanitizeRestingHistory, validEnergy } from '../utils/calorieExpenditure';
import { burnedHistoryDates, sanitizeBurnedHistory } from '../utils/burnedHistory';
import { getHistoricalBurnedCalories, getCalorieExpenditure } from '../api/healthConnect';

import { normalizeReasoning } from '../config/reasoning';

const STORAGE_KEY = 'settings.v1';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [burnedCaloriesHistory, setBurnedCaloriesHistory] = useState({});
  const historyReadInFlight = useRef(false);
  const [dailyGoal, setDailyGoal] = useState(2100);
  const [customMacroGoals, setCustomMacroGoals] = useState(null);
  const [aiModel, setAiModel] = useState(DEFAULT_PUBLIC_MODEL_ID);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [providerModels, setProviderModels] = useState({});
  const [modelReasoning, setModelReasoning] = useState({});
  const [claudeVoiceProvider, setClaudeVoiceProvider] = useState('none');

  const systemLang = Localization.getLocales()[0]?.languageCode;
  const supportedLangs = ['sk', 'en', 'de', 'es', 'fr', 'pl', 'cs', 'it'];
  const initialLang = supportedLangs.includes(systemLang) ? systemLang : 'en';

  const [language, setLanguage] = useState(initialLang);
  const [theme, setTheme] = useState('system');
  const [showCalorieFatEquivalent, setShowCalorieFatEquivalent] = useState(false);
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
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(false);
  const [expenditureEstimateEnabled, setExpenditureEstimateEnabled] = useState(false);
  const [garminModeEnabled, setGarminModeEnabled] = useState(false);
  const [garminRestingCalories, setGarminRestingCalories] = useState(2100);
  const [manualRestingCalories, setManualRestingCalories] = useState(null);
  const [restingEnergyProfile, setRestingEnergyProfile] = useState(null);
  const [restingCaloriesHistory, setRestingCaloriesHistory] = useState({});
  const [dailyEnergyReading, setDailyEnergyReading] = useState(null);
  const [healthExpenditure, setCalorieExpenditure] = useState({ burnedCalories: null });
  const currentHealth = healthConnectEnabled && healthExpenditure.date === localDateKey() ? healthExpenditure : {};
  const burnedCalories = currentHealth.burnedCalories ?? null;
  const garminMode = ['android', 'ios'].includes(Platform.OS) && garminModeEnabled;
  const restingBaseline = garminMode ? { calories: garminRestingCalories, source: 'garmin' } : resolveRestingBaseline({ manual: manualRestingCalories,
    yesterday: currentHealth.yesterdayRestingCalories, history: restingCaloriesHistory });
  const sourceTotal = currentHealth.rawBurnedCalories ?? burnedCalories;
  const garminEstimate = garminMode && currentHealth.sampledAt
    && localDateKey(new Date(currentHealth.sampledAt)) === currentHealth.date
    ? estimateGarminExpenditure(sourceTotal, garminRestingCalories, currentHealth.sampledAt) : null;
  const measuredActiveCalories = garminMode ? (garminEstimate?.active ?? null) : (currentHealth.todayActiveCalories ?? null);
  const rawEstimatedBurnedCalories = estimateDailyExpenditure(restingBaseline.calories, measuredActiveCalories ?? 0);
  const candidate = {
    date: currentHealth.date,
    total: sourceTotal,
    active: measuredActiveCalories,
    estimated: rawEstimatedBurnedCalories,
    calculationKey: `${garminMode ? "garmin" : "health"}:${restingBaseline.calories}`,
  };
  const todayReading = healthConnectEnabled ? rememberDailyEnergyReading(dailyEnergyReading, candidate) : null;
  const activeCalories = todayReading?.active ?? measuredActiveCalories;
  const activeCaloriesAvailable = validEnergy(activeCalories) !== null;
  const estimatedBurnedCalories = estimateDailyExpenditure(restingBaseline.calories, activeCalories ?? 0);
  const healthReadVersion = useRef(0);

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
          if (parsed?.modelReasoning && typeof parsed.modelReasoning === 'object' && !Array.isArray(parsed.modelReasoning)) setModelReasoning(parsed.modelReasoning);
          if (isAIProvider(parsed?.aiProvider)) setAiProvider(parsed.aiProvider);
          if (parsed?.providerModels && typeof parsed.providerModels === 'object') {
            setProviderModels(Object.fromEntries(Object.entries(parsed.providerModels).filter(([id, model]) => isAIProvider(id) && typeof model === 'string' && model.trim())));
          }
          if (['none', 'gemini', 'openai'].includes(parsed?.claudeVoiceProvider)) setClaudeVoiceProvider(parsed.claudeVoiceProvider);
          if (typeof parsed?.language === 'string') setLanguage(parsed.language);
          if (typeof parsed?.showCalorieFatEquivalent === 'boolean') setShowCalorieFatEquivalent(parsed.showCalorieFatEquivalent);
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
          if (typeof parsed?.healthConnectEnabled === 'boolean') setHealthConnectEnabled(parsed.healthConnectEnabled);
          if (typeof parsed?.garminModeEnabled === 'boolean') setGarminModeEnabled(parsed.garminModeEnabled);
          if (validEnergy(parsed?.garminRestingCalories) !== null && parsed.garminRestingCalories <= 10000) setGarminRestingCalories(parsed.garminRestingCalories);
          if (typeof parsed?.expenditureEstimateEnabled === 'boolean') setExpenditureEstimateEnabled(parsed.expenditureEstimateEnabled);
          if (validEnergy(parsed?.manualRestingCalories) !== null && parsed.manualRestingCalories <= 10000) setManualRestingCalories(parsed.manualRestingCalories);
          if (calculateRestingProfile(parsed?.restingEnergyProfile)) setRestingEnergyProfile(parsed.restingEnergyProfile);
          setRestingCaloriesHistory(sanitizeRestingHistory(parsed?.restingCaloriesHistory));
          setBurnedCaloriesHistory(sanitizeBurnedHistory(parsed?.burnedCaloriesHistory));
          setDailyEnergyReading(rememberDailyEnergyReading(parsed?.dailyEnergyReading, null));
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
      JSON.stringify({ modelReasoning, burnedCaloriesHistory, aiProvider, providerModels, claudeVoiceProvider, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showCalorieFatEquivalent, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled, expenditureEstimateEnabled, garminModeEnabled, garminRestingCalories, manualRestingCalories, restingEnergyProfile, restingCaloriesHistory, dailyEnergyReading })
    ).catch(() => { });
  }, [modelReasoning, aiProvider, providerModels, claudeVoiceProvider, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showCalorieFatEquivalent, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled, expenditureEstimateEnabled, garminModeEnabled, garminRestingCalories, manualRestingCalories, restingEnergyProfile, restingCaloriesHistory, dailyEnergyReading, burnedCaloriesHistory, hydrated]);

  useEffect(() => {
    if (!hydrated || !healthConnectEnabled) return;
    setDailyEnergyReading(previous => rememberDailyEnergyReading(previous, candidate));
  }, [hydrated, healthConnectEnabled, candidate.date, candidate.total, candidate.active, candidate.estimated, candidate.calculationKey]);

  const refreshBurnedCalories = async (requestMissingPermissions = false) => {
    const version = ++healthReadVersion.current;
    if (!hydrated || !['android', 'ios'].includes(Platform.OS) || !healthConnectEnabled) {
      setCalorieExpenditure({ burnedCalories: null, estimatedBurnedCalories: null });
      return null;
    }
    try {
      const expenditure = await getCalorieExpenditure({ requestMissingPermissions, garminMode });
      if (version !== healthReadVersion.current) return null;
      setCalorieExpenditure(expenditure);
      if (validEnergy(expenditure.burnedCalories) !== null) {
        setBurnedCaloriesHistory(history => ({ ...history, [expenditure.date]: history[expenditure.date]?.source === 'csv' ? history[expenditure.date] : { calories: expenditure.burnedCalories, activeCalories: validEnergy(garminMode ? estimateGarminExpenditure(expenditure.rawBurnedCalories ?? expenditure.burnedCalories, garminRestingCalories, expenditure.sampledAt)?.active : expenditure.todayActiveCalories), restingCalories: validEnergy(expenditure.todayRestingCalories), checkedOn: localDateKey() } }));
      }
      if (!garminMode) setRestingCaloriesHistory(history => rememberRestingEnergy(history, expenditure.date, expenditure.todayRestingCalories));
      return expenditure.burnedCalories;
    } catch {
      if (version !== healthReadVersion.current) return null;
      setCalorieExpenditure({ burnedCalories: null, estimatedBurnedCalories: null });
      return null;
    }
  };

  useEffect(() => {
    ++healthReadVersion.current;
    if (!hydrated || !['android', 'ios'].includes(Platform.OS) || !healthConnectEnabled) {
      setCalorieExpenditure({ burnedCalories: null, estimatedBurnedCalories: null });
      return undefined;
    }
    refreshBurnedCalories(true);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshBurnedCalories();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshBurnedCalories();
    }, (garminMode ? 1 : 5) * 60 * 1000);
    return () => {
      ++healthReadVersion.current;
      subscription.remove();
      clearInterval(timer);
    };
  }, [healthConnectEnabled, hydrated, garminMode]);

  useEffect(() => {
    if (!hydrated || !healthConnectEnabled || Platform.OS !== 'android' || historyReadInFlight.current) return;
    const dates = burnedHistoryDates(burnedCaloriesHistory);
    if (!dates.length) return;
    historyReadInFlight.current = true;
    getHistoricalBurnedCalories(dates).then(values => {
      if (Object.keys(values).length) setBurnedCaloriesHistory(history => ({ ...history, ...Object.fromEntries(Object.entries(values).filter(([date]) => history[date]?.source !== 'csv')) }));
    }).catch(() => {}).finally(() => { historyReadInFlight.current = false; });
  }, [hydrated, healthConnectEnabled, currentHealth.date]);

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
      reasoningLevel: normalizeReasoning(aiProvider, aiProvider === 'gemini' ? aiModel : (providerModels[aiProvider] || DEFAULT_MODELS[aiProvider]), modelReasoning[`${aiProvider}:${aiProvider === 'gemini' ? aiModel : (providerModels[aiProvider] || DEFAULT_MODELS[aiProvider])}`]),
      setReasoningLevel: level => setModelReasoning(previous => ({ ...previous, [`${aiProvider}:${aiProvider === 'gemini' ? aiModel : (providerModels[aiProvider] || DEFAULT_MODELS[aiProvider])}`]: level })),
      aiModel: aiProvider === 'gemini' ? aiModel : (providerModels[aiProvider] || DEFAULT_MODELS[aiProvider]),
      setAiModel: model => aiProvider === 'gemini' ? setAiModel(model) : setProviderModels(previous => ({ ...previous, [aiProvider]: model })),
      language,
      setLanguage,
      theme: effectiveTheme, // Export resolved theme for UI consumption
      userTheme: theme,      // Export raw setting for SettingsPicker
      setTheme,
      colorTheme,
      setColorTheme,
      showCalorieFatEquivalent,
      setShowCalorieFatEquivalent,
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
      healthConnectEnabled,
      setHealthConnectEnabled,
      burnedCaloriesHistory,
      importBurnedCalories: values => setBurnedCaloriesHistory(history => ({ ...history, ...sanitizeBurnedHistory(values) })),
      burnedCalories,
      estimatedBurnedCalories,
      expenditureEstimateEnabled,
      setExpenditureEstimateEnabled,
      manualRestingCalories,
      setManualRestingCalories,
      restingEnergyProfile,
      setRestingEnergyProfile,
      restingCaloriesBaseline: restingBaseline.calories,
      restingCaloriesSource: restingBaseline.source,
      activeCaloriesAvailable,
      activeCalories,
      garminModeEnabled,
      setGarminModeEnabled,
      garminRestingCalories,
      setGarminRestingCalories,
      refreshBurnedCalories,
    };
  }, [modelReasoning, aiProvider, providerModels, claudeVoiceProvider, hydrated, dailyGoal, customMacroGoals, aiModel, language, theme, colorTheme, showCalorieFatEquivalent, showLatestMeal, useLocalStorage, customModels, foodCategories, saveFoodImages, showImagesInHistory, showUniqueHistorySearchResults, termsAccepted, autoSaveEnabled, autoSaveSeconds, healthConnectEnabled, burnedCaloriesHistory, burnedCalories, estimatedBurnedCalories, expenditureEstimateEnabled, manualRestingCalories, restingEnergyProfile, restingCaloriesHistory, garminModeEnabled, garminRestingCalories, activeCalories, currentHealth.todayActiveCalories, activeCaloriesAvailable, restingBaseline.calories, restingBaseline.source, colorScheme]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
