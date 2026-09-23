import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MODEL_CATALOG, coerceModelId, DEFAULT_PUBLIC_MODEL_ID } from '../config/aiModels';

import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { exportUserData, getFriendlyError } from '../api/backend';
import { getAllMeals, importMeals, clearAllMeals } from '../api/mealService';
import { clearCategoryFromFavorites, getFavoriteImageUris } from '../api/favoritesService';
import { getGeminiKey, setGeminiKey } from '../utils/secureStorage';
import { escapeCsvField, parseCsvRow, parseFiniteNumber } from '../utils/csv';
import TermsModal from '../components/TermsModal';
import MacroGoalsDialog from '../components/MacroGoalsDialog';
function clampDailyGoal(value) {
  if (!Number.isFinite(value)) return 2100;
  return Math.max(500, Math.min(10000, Math.round(value)));
}

const HISTORY_EXPORT_FORMAT = 'calories-ai-history';
const HISTORY_STREAM_VERSION = 2;
const HISTORY_READ_CHUNK_SIZE = 64 * 1024;

// JSON permits all non-ASCII characters to be written as \uXXXX escapes. Keeping
// the streamed format ASCII lets us encode and split chunks without creating a
// second full-file string or depending on a platform-specific text codec.
function stringifyAsciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function asciiStringToBytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function asciiBytesToString(bytes) {
  let value = '';
  const step = 8192;
  for (let offset = 0; offset < bytes.length; offset += step) {
    value += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + step, bytes.length)));
  }
  return value;
}

function writeJsonLine(fileHandle, value) {
  fileHandle.writeBytes(asciiStringToBytes(`${stringifyAsciiJson(value)}\n`));
}

async function isStreamedHistoryExport(fileUri) {
  const file = new ExpoFile(fileUri);
  const handle = file.open();
  try {
    const firstChunk = asciiBytesToString(handle.readBytes(Math.min(HISTORY_READ_CHUNK_SIZE, file.size)));
    const firstLineEnd = firstChunk.indexOf('\n');
    if (firstLineEnd < 0) return false;
    const header = JSON.parse(firstChunk.slice(0, firstLineEnd).trim());
    return header?.format === HISTORY_EXPORT_FORMAT && header?.version === HISTORY_STREAM_VERSION;
  } catch {
    return false;
  } finally {
    handle.close();
  }
}

async function readJsonLines(fileUri, onRecord) {
  const file = new ExpoFile(fileUri);
  const handle = file.open();
  let pending = '';
  let lineNumber = 0;

  try {
    while ((handle.offset ?? 0) < (handle.size ?? 0)) {
      const remaining = (handle.size ?? 0) - (handle.offset ?? 0);
      pending += asciiBytesToString(handle.readBytes(Math.min(HISTORY_READ_CHUNK_SIZE, remaining)));

      let newlineIndex = pending.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = pending.slice(0, newlineIndex).trim();
        pending = pending.slice(newlineIndex + 1);
        if (line) await onRecord(JSON.parse(line), lineNumber);
        lineNumber += 1;
        newlineIndex = pending.indexOf('\n');
      }
    }

    const finalLine = pending.trim();
    if (finalLine) await onRecord(JSON.parse(finalLine), lineNumber);
  } finally {
    handle.close();
  }
}

const Dropdown = ({ label, value, options, onSelect, hint, colors }) => {
  const t = useTranslation();
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {hint && <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.dropdownTrigger,
          { backgroundColor: colors.elemBg, borderColor: colors.elemBorder },
          pressed && styles.dropdownTriggerPressed,
        ]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.dropdownValue, { color: colors.text }]}>
          {selectedOption ? selectedOption.label : '...'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.elemBorder }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
              <Pressable onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView bounces={false}>
              {options.map((opt) => {
                const active = opt.id === value;
                return (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                      active && { backgroundColor: `${colors.accent}14` },
                      pressed && { backgroundColor: `${colors.accent}14` },
                      { borderBottomColor: colors.elemBorder }
                    ]}
                    onPress={() => {
                      onSelect(opt.id);
                      setVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: active ? colors.accent : colors.text }]}>
                        {opt.label}
                      </Text>
                      {(opt.descriptionKey || opt.description) && (
                        <Text style={[styles.optionDesc, { color: colors.muted }]}>
                          {opt.descriptionKey ? t[opt.descriptionKey] : opt.description}
                        </Text>
                      )}
                    </View>
                    {active && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default function SettingsScreen() {
  const t = useTranslation();
  const { dailyGoal, setDailyGoal, aiModel, setAiModel, language, setLanguage, theme, userTheme, setTheme, useLocalStorage, setUseLocalStorage, customModels, setCustomModels, foodCategories, setFoodCategories, saveFoodImages, setSaveFoodImages, showImagesInHistory, setShowImagesInHistory, showUniqueHistorySearchResults, setShowUniqueHistorySearchResults, autoSaveEnabled, setAutoSaveEnabled, autoSaveSeconds, setAutoSaveSeconds, healthConnectEnabled, setHealthConnectEnabled } = useSettings();

  const colors = theme === 'light'
    ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)', elemBg: '#F1F5F9', elemBorder: 'rgba(0,0,0,0.05)', modalBg: '#FFFFFF' }
    : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)', elemBg: 'rgba(255,255,255,0.06)', elemBorder: 'rgba(255,255,255,0.12)', modalBg: '#161B22' };

  const [dailyGoalInput, setDailyGoalInput] = useState(String(dailyGoal));
  const [macroGoalsOpen, setMacroGoalsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [autoSaveSecondsInput, setAutoSaveSecondsInput] = useState(String(autoSaveSeconds));

  useEffect(() => {
    // Load API Key
    getGeminiKey().then(k => {
      if (k) setApiKey(k);
    });
  }, []);

  const handleSaveKey = async () => {
    await setGeminiKey(apiKey);
    Alert.alert(t.saved, t.apiKeySavedMsg);
  };

  const allowedModels = useMemo(() => {
    return [...MODEL_CATALOG, ...customModels];
  }, [customModels]);

  const languageOptions = useMemo(
    () => [
      { id: 'sk', label: 'Slovenčina' },
      { id: 'en', label: 'English' },
      { id: 'de', label: 'Deutsch' },
      { id: 'es', label: 'Español' },
      { id: 'fr', label: 'Français' },
      { id: 'pl', label: 'Polski' },
      { id: 'cs', label: 'Čeština' },
      { id: 'it', label: 'Italiano' },
    ],
    []
  );

  const themeOptions = useMemo(
    () => [
      { id: 'system', label: t.themeSystem || 'System' },
      { id: 'dark', label: t.themeDark },
      { id: 'light', label: t.themeLight },
    ],
    [t.themeSystem, t.themeDark, t.themeLight]
  );

  const updateDailyGoal = () => {
    const parsed = parseFloat(String(dailyGoalInput).replace(',', '.'));
    const clamped = clampDailyGoal(parsed);
    setDailyGoal(clamped);
    setDailyGoalInput(String(clamped));
  };

  // Export Logic
  const [exporting, setExporting] = useState(false);
  const [exportingHistoryJson, setExportingHistoryJson] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingHistoryJson, setImportingHistoryJson] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const handleImport = async () => {
    try {
      setImporting(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setImporting(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error(t.importErrorEmpty);
      }

      // We ignore the header row (index 0) and parse columns by order to support any language headers
      // Expected Order: Date, Name, Calories, Protein, Carbs, Fat, Weight

      const mealsToImport = [];

      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvRow(lines[i]);
        if (row.length < 3) continue; // minimal valid row

        const dateStr = row[0]?.trim();
        const name = row[1]?.trim() || t.importedMealDefault;
        const cals = parseFiniteNumber(row[2]);
        const prot = parseFiniteNumber(row[3]);
        const carbs = parseFiniteNumber(row[4]);
        const fat = parseFiniteNumber(row[5]);
        const weight = parseFiniteNumber(row[6]);

        let timestamp;
        try {
          timestamp = new Date(dateStr).toISOString();
        } catch {
          timestamp = new Date().toISOString();
        }

        mealsToImport.push({
          name,
          calories: cals,
          protein: prot,
          carbs: carbs,
          fat: fat,
          weight_g: weight,
          timestamp,
          imported: true
        });
      }

      const importedCount = await importMeals(mealsToImport);

      Alert.alert(t.success, `${t.importedMsg} ${importedCount}`);

    } catch (e) {
      console.error('Import failed', e);
      Alert.alert(t.errorTitle, t.importFailed);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      let csvData = '';

      // Always local export now
      const meals = await getAllMeals(true);
      // Header
      csvData = `\uFEFF${[t.csvHeaderDate, t.csvHeaderName, t.csvHeaderCals, t.csvHeaderProt, t.csvHeaderCarbs, t.csvHeaderFat, t.csvHeaderWeight].map(escapeCsvField).join(',')}\n`;

      // Rows
      meals.forEach(m => {
        const date = m.timestamp || new Date().toISOString();
        const name = m.name || '';
        const cals = m.calories || 0;
        const p = m.protein || 0;
        const c = m.carbs || 0;
        const f = m.fat || 0;
        const w = m.weight_g || 0;
        csvData += [date, name, cals, p, c, f, w].map(escapeCsvField).join(',') + '\n';
      });

      const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 16);
      const fileUri = FileSystem.documentDirectory + `meals_export_${timestamp}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        Alert.alert(t.info, t.exportDataSuccess);
      } else {
        Alert.alert(t.info, t.sharingUnavailable);
      }

    } catch (e) {
      console.error('Export failed', e);
      const friendly = getFriendlyError(e, { operation: 'export' });
      Alert.alert(friendly.title, friendly.message || t.exportDataError);
    } finally {
      setExporting(false);
    }
  };

  const handleHistoryJsonExport = async () => {
    let fileHandle = null;
    let outputFile = null;
    try {
      setExportingHistoryJson(true);
      const meals = await getAllMeals(true);
      const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 16);
      const fileUri = `${FileSystem.documentDirectory}meal_history_full_${timestamp}.json`;
      outputFile = new ExpoFile(fileUri);
      outputFile.create({ overwrite: true, intermediates: true });
      fileHandle = outputFile.open();
      writeJsonLine(fileHandle, {
        format: HISTORY_EXPORT_FORMAT,
        version: HISTORY_STREAM_VERSION,
        encoding: 'json-lines',
        exportedAt: new Date().toISOString(),
        mealCount: meals.length,
      });

      // Each image and meal is released before the next one is loaded. This keeps
      // exports with many photos below the JavaScript string and memory limits.
      for (const meal of meals) {
        let exportedImage = null;
        if (meal.imageUri?.startsWith('data:image/')) {
          exportedImage = meal.imageUri;
        } else if (meal.imageUri) {
          try {
            const path = meal.imageUri.toLowerCase().split('?')[0];
            const mimeType = path.endsWith('.png') ? 'image/png'
              : path.endsWith('.webp') ? 'image/webp'
                : path.endsWith('.gif') ? 'image/gif'
                  : 'image/jpeg';
            const base64 = await FileSystem.readAsStringAsync(meal.imageUri, { encoding: FileSystem.EncodingType.Base64 });
            exportedImage = `data:${mimeType};base64,${base64}`;
          } catch (imageError) {
            console.warn('History image could not be exported', meal.imageUri, imageError);
          }
        }
        writeJsonLine(fileHandle, { ...meal, imageUri: exportedImage });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      fileHandle.close();
      fileHandle = null;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', UTI: 'public.json' });
        Alert.alert(t.info, t.exportHistoryJsonSuccess || 'Celá história bola exportovaná.');
      } else {
        Alert.alert(t.info, t.sharingUnavailable);
      }
    } catch (e) {
      console.error('Full history export failed', e);
      if (fileHandle) {
        try { fileHandle.close(); } catch {}
        fileHandle = null;
      }
      if (outputFile?.exists) {
        try { outputFile.delete(); } catch {}
      }
      const friendly = getFriendlyError(e, { operation: 'export' });
      Alert.alert(friendly.title, friendly.message || t.exportDataError);
    } finally {
      if (fileHandle) {
        try { fileHandle.close(); } catch {}
      }
      setExportingHistoryJson(false);
    }
  };

  const handleHistoryJsonImport = async () => {
    try {
      setImportingHistoryJson(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'application/x-ndjson', 'application/octet-stream', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const photoDirectory = `${FileSystem.documentDirectory}meal_photos/`;
      let photoDirectoryReady = false;
      let restoredImageCount = 0;
      const mealsToImport = [];

      const restoreMeal = async (rawMeal, index) => {
        if (!rawMeal || typeof rawMeal !== 'object' || Array.isArray(rawMeal)) return;
        let imageUri = null;
        const imageMatch = typeof rawMeal.imageUri === 'string'
          ? rawMeal.imageUri.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i)
          : null;
        if (imageMatch) {
          let temporaryImageUri = null;
          try {
            if (!photoDirectoryReady) {
              await FileSystem.makeDirectoryAsync(photoDirectory, { intermediates: true });
              photoDirectoryReady = true;
            }
            const extension = imageMatch[1].toLowerCase() === 'image/png' ? 'png'
              : imageMatch[1].toLowerCase() === 'image/webp' ? 'webp'
                : imageMatch[1].toLowerCase() === 'image/gif' ? 'gif'
                  : 'jpg';
            temporaryImageUri = `${FileSystem.cacheDirectory}history_import_${Date.now()}_${index}.${extension}`;
            await FileSystem.writeAsStringAsync(temporaryImageUri, imageMatch[2], { encoding: FileSystem.EncodingType.Base64 });
            const compressed = await manipulateAsync(
              temporaryImageUri,
              [{ resize: { width: 600 } }],
              { compress: 0.7, format: SaveFormat.JPEG }
            );
            imageUri = `${photoDirectory}imported_${Date.now()}_${index}.jpg`;
            await FileSystem.moveAsync({ from: compressed.uri, to: imageUri });
            await FileSystem.deleteAsync(temporaryImageUri, { idempotent: true });
            restoredImageCount += 1;
          } catch (imageError) {
            if (temporaryImageUri) await FileSystem.deleteAsync(temporaryImageUri, { idempotent: true }).catch(() => {});
            imageUri = null;
            console.warn('History image could not be restored', imageError);
          }
        }

        const parsedTimestamp = new Date(rawMeal.timestamp);
        const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date().toISOString() : parsedTimestamp.toISOString();
        const { id: ignoredId, imageUri: ignoredImageUri, ...mealData } = rawMeal;
        mealsToImport.push({
          ...mealData,
          name: String(rawMeal.name || t.importedMealDefault || 'Jedlo').slice(0, 200),
          timestamp,
          imageUri,
          imported: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      };

      const fileUri = result.assets[0].uri;
      if (await isStreamedHistoryExport(fileUri)) {
        await readJsonLines(fileUri, async (record, lineNumber) => {
          if (lineNumber === 0) {
            if (record?.format !== HISTORY_EXPORT_FORMAT || record?.version !== HISTORY_STREAM_VERSION) {
              throw new Error('INVALID_HISTORY_JSON');
            }
            return;
          }
          await restoreMeal(record, lineNumber - 1);
        });
      } else {
        // Version 1 files used a single JSON object. Keep this path so existing
        // backups remain importable; all new exports use the streamed format.
        const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
        const payload = JSON.parse(content);
        if (payload?.format !== HISTORY_EXPORT_FORMAT || payload?.version !== 1 || !Array.isArray(payload?.meals)) {
          throw new Error('INVALID_HISTORY_JSON');
        }
        for (let index = 0; index < payload.meals.length; index += 1) {
          await restoreMeal(payload.meals[index], index);
        }
      }

      const importedCount = await importMeals(mealsToImport);

      Alert.alert(
        t.success || 'Hotovo',
        (t.importHistoryJsonSuccess || 'Importovaných položiek: {count}. Obnovených obrázkov: {images}.')
          .replace('{count}', String(importedCount))
          .replace('{images}', String(restoredImageCount))
      );
    } catch (e) {
      console.error('Full history import failed', e);
      Alert.alert(
        t.errorTitle || 'Chyba',
        e?.message === 'INVALID_HISTORY_JSON'
          ? (t.importHistoryJsonInvalid || 'Vybraný súbor nie je platný export histórie.')
          : (t.importFailed || 'Import zlyhal.')
      );
    } finally {
      setImportingHistoryJson(false);
    }
  };

  const handleClearHistory = async () => {
    const meals = await getAllMeals();
    if (meals.length === 0) {
      Alert.alert(t.info || 'Informácia', t.clearHistoryEmpty || 'História je už prázdna.');
      return;
    }
    Alert.alert(
      t.clearHistoryTitle || 'Vymazať celú históriu?',
      (t.clearHistoryConfirm || 'Natrvalo sa odstráni {count} záznamov aj ich obrázky. Túto akciu nemožno vrátiť späť.')
        .replace('{count}', String(meals.length)),
      [
        { text: t.cancel || 'Zrušiť', style: 'cancel' },
        {
          text: t.delete || 'Vymazať',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingHistory(true);
              const favoriteImageUris = await getFavoriteImageUris();
              const { deletedCount, deletedImageCount } = await clearAllMeals(favoriteImageUris);
              Alert.alert(
                t.success || 'Hotovo',
                (t.clearHistorySuccess || 'Odstránených záznamov: {count}. Vymazaných obrázkov: {images}.')
                  .replace('{count}', String(deletedCount))
                  .replace('{images}', String(deletedImageCount))
              );
            } catch (e) {
              console.error('Clear history failed', e);
              Alert.alert(t.errorTitle || 'Chyba', t.exportDataError || 'Históriu sa nepodarilo vymazať.');
            } finally {
              setClearingHistory(false);
            }
          },
        },
      ]
    );
  };

  // Custom Models Logic
  const [addingModel, setAddingModel] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const handleAddCustomModel = () => {
    if (!newModelId.trim() || !newModelName.trim()) {
      return;
    }

    const newId = newModelId.trim();
    const newLabel = newModelName.trim();

    if (editingModel) {
      // Edit Mode
      const updatedModels = customModels.map(m =>
        m.id === editingModel.id ? { ...m, id: newId, label: newLabel } : m
      );
      setCustomModels(updatedModels);

      // If ID changed and was selected
      if (editingModel.id !== newId && aiModel === editingModel.id) {
        setAiModel(newId);
      }

      Alert.alert(t.success, t.saved || 'Uložené');
    } else {
      // Add Mode
      // Check duplicate ID
      if (customModels.some(m => m.id === newId) || MODEL_CATALOG.some(m => m.id === newId)) {
        Alert.alert(t.errorTitle, 'Model ID already exists');
        return;
      }

      const newModel = {
        id: newId,
        label: newLabel,
        isCustom: true
      };
      setCustomModels([...customModels, newModel]);
      Alert.alert(t.success, t.modelAddedSuccess);
    }

    setNewModelId('');
    setNewModelName('');
    setEditingModel(null);
    setAddingModel(false);
  };

  const handleEditModel = (model) => {
    setNewModelId(model.id);
    setNewModelName(model.label);
    setEditingModel(model);
    setAddingModel(true);
  };

  const handleDeleteModel = (modelId) => {
    Alert.alert(
      t.deleteMealTitle,
      t.deleteModelConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            const filtered = customModels.filter(m => m.id !== modelId);
            setCustomModels(filtered);
            if (aiModel === modelId) {
              setAiModel(DEFAULT_PUBLIC_MODEL_ID); // Fallback
            }
            Alert.alert(t.success, t.modelDeletedSuccess);
          }
        }
      ]
    );
  };

  const closeModelModal = () => {
    setAddingModel(false);
    setEditingModel(null);
    setNewModelId('');
    setNewModelName('');
  };

  // Food Categories Logic
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const label = newCategoryName.trim();

    if (editingCategory) {
      const updated = foodCategories.map(c =>
        c.id === editingCategory.id ? { ...c, label } : c
      );
      setFoodCategories(updated);
      Alert.alert(t.success, t.saved || 'Uložené');
    } else {
      const id = Date.now().toString();
      setFoodCategories([...foodCategories, { id, label }]);
      Alert.alert(t.success, t.categoryAddedSuccess || 'Category added.');
    }

    setNewCategoryName('');
    setEditingCategory(null);
    setAddingCategory(false);
  };

  const handleEditCategory = (cat) => {
    setNewCategoryName(cat.label);
    setEditingCategory(cat);
    setAddingCategory(true);
  };

  const handleDeleteCategory = (catId) => {
    Alert.alert(
      t.deleteMealTitle,
      t.deleteCategoryConfirm || 'Delete this category?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            setFoodCategories(foodCategories.filter(c => c.id !== catId));
            await clearCategoryFromFavorites(catId);
            Alert.alert(t.success, t.categoryDeletedSuccess || 'Category deleted.');
          }
        }
      ]
    );
  };

  const handleMoveCategory = (catId, direction) => {
    const idx = foodCategories.findIndex(c => c.id === catId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= foodCategories.length) return;
    const updated = [...foodCategories];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setFoodCategories(updated);
  };

  const closeCategoryModal = () => {
    setAddingCategory(false);
    setEditingCategory(null);
    setNewCategoryName('');
  };

  return (

    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
      <View style={styles.headerBlock}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.settingsTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} indicatorStyle={theme === 'light' ? 'black' : 'white'} keyboardShouldPersistTaps="handled">
        {/* 1. Daily Goal */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t.dailyGoal}</Text>
          <View style={styles.row}>
            <TextInput
              value={dailyGoalInput}
              onChangeText={setDailyGoalInput}
              onEndEditing={updateDailyGoal}
              keyboardType="numeric"
              inputMode="numeric"
              style={[styles.input, { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, color: colors.text }]}
              placeholder="napr. 2100"
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.unit, { color: colors.muted }]}>kcal</Text>
          </View>
        </View>

        <Pressable onPress={() => setMacroGoalsOpen(true)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Ionicons name="nutrition-outline" size={24} color={colors.accent} />
          <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>{t.macroGoalsTitle}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        {/* 2. API Key */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.accent }]}>Gemini {t.apiKeyLabel}</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.elemBg, borderColor: colors.elemBorder }]}>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              // onEndEditing={handleSaveKey} // Save on button press preferred for security fields
              secureTextEntry={!showKey}
              style={[
                styles.input,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  flex: 1,
                  color: colors.text
                }
              ]}
              placeholder={t.apiKeyPlaceholder}
              placeholderTextColor={colors.muted}
            />
            <Pressable onPress={() => setShowKey(!showKey)} style={{ padding: 10 }}>
              <Ionicons name={showKey ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Pressable
            onPress={handleSaveKey}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, marginTop: 8 },
              pressed && styles.pressed
            ]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t.save}</Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.muted, marginTop: 8, fontSize: 12 }]}>
            {t.apiKeyHint}
          </Text>
        </View>

        {/* 3. Theme */}
        <Dropdown
          label={t.theme}
          value={userTheme}
          options={themeOptions}
          onSelect={setTheme}
          colors={colors}
        />

        {/* 4. Save Photos Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: colors.text }]}>{t.saveFoodImagesTitle}</Text>
              <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>{t.saveFoodImagesHint}</Text>
            </View>
            <Switch
              value={saveFoodImages}
              onValueChange={setSaveFoodImages}
              trackColor={{ false: colors.elemBg, true: colors.accent }}
              thumbColor={'#fff'}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.elemBorder, marginBottom: 16 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: colors.text }]}>{t.showImagesInHistoryTitle}</Text>
              <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>{t.showImagesInHistoryHint}</Text>
            </View>
            <Switch
              value={showImagesInHistory}
              onValueChange={setShowImagesInHistory}
              trackColor={{ false: colors.elemBg, true: colors.accent }}
              thumbColor={'#fff'}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.elemBorder, marginVertical: 16 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: colors.text }]}>{t.uniqueHistorySearchTitle}</Text>
              <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>{t.uniqueHistorySearchHint}</Text>
            </View>
            <Switch
              value={showUniqueHistorySearchResults}
              onValueChange={setShowUniqueHistorySearchResults}
              trackColor={{ false: colors.elemBg, true: colors.accent }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {/* Auto-Save Settings */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: autoSaveEnabled ? 16 : 0 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: colors.text }]}>{t.autoSaveTitle || 'Automatické uloženie'}</Text>
              <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>{t.autoSaveDescription || 'Uloží analýzu automaticky po uplynutí času'}</Text>
            </View>
            <Switch
              value={autoSaveEnabled}
              onValueChange={setAutoSaveEnabled}
              trackColor={{ false: colors.elemBg, true: colors.accent }}
              thumbColor={'#fff'}
            />
          </View>

          {autoSaveEnabled && (
            <>
              <View style={{ height: 1, backgroundColor: colors.elemBorder, marginBottom: 12 }} />
              <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t.autoSaveSecondsLabel || 'Počet sekúnd'}</Text>
              <View style={styles.row}>
                <TextInput
                  value={autoSaveSecondsInput}
                  onChangeText={setAutoSaveSecondsInput}
                  onEndEditing={() => {
                    const v = parseInt(autoSaveSecondsInput, 10);
                    const clamped = Math.max(3, Math.min(60, Number.isFinite(v) ? v : 5));
                    setAutoSaveSeconds(clamped);
                    setAutoSaveSecondsInput(String(clamped));
                  }}
                  keyboardType="numeric"
                  inputMode="numeric"
                  style={[styles.input, { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, color: colors.text }]}
                  placeholder="5"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.unit, { color: colors.muted }]}>s</Text>
              </View>
            </>
          )}
        </View>

        {/* Health Connect Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: colors.text }]}>{'Google Health Connect'}</Text>
              <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>{t.healthConnectHint || 'Čítanie a zápis spálených kalórií'}</Text>
            </View>
            <Switch
              value={healthConnectEnabled}
              onValueChange={async (val) => {
                if (val) {
                  try {
                    const { requestHealthPermissions, isHealthConnectAvailable } = require('../api/healthConnectService');
                    const available = await isHealthConnectAvailable();
                    if (!available) {
                      Alert.alert('Health Connect', t.healthConnectUnavailable || 'Health Connect nie je dostupný na tomto zariadení.');
                      return;
                    }
                    const granted = await requestHealthPermissions();
                    if (!granted) {
                      Alert.alert('Health Connect', t.healthConnectDenied || 'Povolenie bolo zamietnuté.');
                      return;
                    }
                  } catch (e) {
                    console.warn('HC permission error:', e);
                  }
                }
                setHealthConnectEnabled(val);
              }}
              trackColor={{ false: colors.elemBg, true: colors.accent }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {/* 5. AI Model */}
        <Dropdown
          label={t.aiModel}
          hint={t.aiModelHint}
          value={aiModel}
          options={allowedModels}
          onSelect={setAiModel}
          colors={colors}
        />

        {/* Manage Custom Models */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t.manageModelsTitle}</Text>

          {customModels.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 8, backgroundColor: colors.elemBg, borderRadius: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{m.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{m.id}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => handleEditModel(m)}>
                  <Ionicons name="pencil" size={20} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => handleDeleteModel(m.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => setAddingModel(true)}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, marginTop: 4 },
              pressed && styles.pressed
            ]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t.addCustomModelBtn}</Text>
          </Pressable>
        </View>

        {/* Manage Food Categories */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t.manageCategoriesTitle || 'Kategórie jedál'}</Text>

          {foodCategories.map((c, index) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 8, backgroundColor: colors.elemBg, borderRadius: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{c.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Pressable
                  onPress={() => handleMoveCategory(c.id, -1)}
                  style={{ opacity: index === 0 ? 0.25 : 1 }}
                  disabled={index === 0}
                >
                  <Ionicons name="chevron-up" size={20} color={colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => handleMoveCategory(c.id, 1)}
                  style={{ opacity: index === foodCategories.length - 1 ? 0.25 : 1 }}
                  disabled={index === foodCategories.length - 1}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.muted} />
                </Pressable>
                <Pressable onPress={() => handleEditCategory(c)}>
                  <Ionicons name="pencil" size={20} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => handleDeleteCategory(c.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => setAddingCategory(true)}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, marginTop: 4 },
              pressed && styles.pressed
            ]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t.addCategoryBtn || 'Pridať kategóriu'}</Text>
          </Pressable>
        </View>

        {/* 5. Language */}
        <Dropdown
          label={t.language}
          hint={t.languageHint}
          value={language}
          options={languageOptions}
          onSelect={setLanguage}
          colors={colors}
        />

        <View style={{ flex: 1 }} />

        {/* 6. Data Management */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t.dataManagementTitle}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, flex: 1 },
                pressed && styles.pressed
              ]}
              onPress={handleExport}
              disabled={exporting}
            >
              <Text style={[styles.btnText, { color: colors.accent }]}>
                {exporting ? '...' : t.exportDataBtn}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, flex: 1 },
                pressed && styles.pressed
              ]}
              onPress={handleImport}
              disabled={importing}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>
                {importing ? '...' : (t.importDataBtn || 'Import CSV')}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, flex: 1 },
                pressed && styles.pressed
              ]}
              onPress={handleHistoryJsonExport}
              disabled={exportingHistoryJson}
            >
              <Text style={[styles.btnText, { color: colors.accent }]}>
                {exportingHistoryJson ? '...' : (t.exportHistoryJsonBtn || 'Export history + images (JSON)')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.elemBg, borderColor: colors.elemBorder, flex: 1 },
                pressed && styles.pressed
              ]}
              onPress={handleHistoryJsonImport}
              disabled={importingHistoryJson}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>
                {importingHistoryJson ? '...' : (t.importHistoryJsonBtn || 'Import history (JSON)')}
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' },
              pressed && styles.pressed
            ]}
            onPress={handleClearHistory}
            disabled={clearingHistory}
          >
            <Text style={[styles.btnText, { color: '#EF4444' }]}>
              {clearingHistory ? '...' : (t.clearHistoryBtn || 'Vymazať celú históriu')}
            </Text>
          </Pressable>
        </View>

        {/* 7. Credits */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t.creditsTitle || 'Credits'}</Text>

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4 }]}>{t.developerContact || 'Developer:'}</Text>
          <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 12 }} onPress={() => Linking.openURL(`mailto:caloriesai@centrum.sk?subject=${t.emailSubject}`)}>
            caloriesai@centrum.sk
          </Text>

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4 }]}>Info:</Text>
          <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 6 }} onPress={() => Linking.openURL('https://kalorie-jedlo-web-rot.web.app/')}>
            🌐 {t.website}
          </Text>
          <Pressable onPress={() => setShowTerms(true)}>
            <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 12 }}>
              📄 {t.termsConditions}
            </Text>
          </Pressable>

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4 }]}>Support:</Text>
          <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 12 }} onPress={() => Linking.openURL('https://ko-fi.com/caloriesai')}>
            ☕ {t.buyMeCoffee}
          </Text>

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4, marginTop: 12 }]}>{t.poweredBy || 'Powered by:'}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Expo • React Native • Gemini API
          </Text>
        </View>
      </ScrollView>

      {/* Add/Edit Custom Model Modal */}
      <Modal visible={addingModel} transparent animationType="fade" onRequestClose={closeModelModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModelModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.modalBg, borderColor: colors.border, width: '90%' }]} onPress={() => { }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>
                {editingModel ? (t.editMealTitle ? t.editMealTitle.replace('jedlo', 'model').replace('Meal', 'Model') : 'Edit Model') : t.addCustomModelBtn}
              </Text>

              <Text style={[styles.label, { color: colors.muted, fontSize: 14 }]}>{t.customModelNameLabel}</Text>
              <TextInput
                value={newModelName}
                onChangeText={setNewModelName}
                style={[styles.input, { flex: 0, minHeight: 60, fontSize: 18, backgroundColor: colors.elemBg, borderColor: colors.elemBorder, color: colors.text, marginBottom: 16 }]}
                placeholder={t.customModelNamePlaceholder}
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted, fontSize: 14 }]}>{t.customModelIdLabel}</Text>
              <TextInput
                value={newModelId}
                onChangeText={setNewModelId}
                style={[styles.input, { flex: 0, minHeight: 60, fontSize: 18, backgroundColor: colors.elemBg, borderColor: colors.elemBorder, color: colors.text, marginBottom: 24 }]}
                placeholder={t.customModelIdPlaceholder}
                placeholderTextColor={colors.muted}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Pressable onPress={closeModelModal} style={{ padding: 10 }}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>{t.cancel}</Text>
                </Pressable>
                <Pressable onPress={handleAddCustomModel} style={{ padding: 10, backgroundColor: colors.accent, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{editingModel ? (t.save || 'Save') : t.confirm}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add/Edit Category Modal */}
      <Modal visible={addingCategory} transparent animationType="fade" onRequestClose={closeCategoryModal}>
        <Pressable style={styles.modalOverlay} onPress={closeCategoryModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.modalBg, borderColor: colors.border, width: '90%' }]} onPress={() => { }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>
                {editingCategory ? (t.editMealTitle || 'Edit') : (t.addCategoryBtn || 'Add Category')}
              </Text>

              <Text style={[styles.label, { color: colors.muted, fontSize: 14 }]}>{t.categoryNameLabel || 'Názov kategórie'}</Text>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                style={[styles.input, { flex: 0, minHeight: 60, fontSize: 18, backgroundColor: colors.elemBg, borderColor: colors.elemBorder, color: colors.text, marginBottom: 24 }]}
                placeholder={t.categoryNamePlaceholder || 'napr. Raňajky'}
                placeholderTextColor={colors.muted}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Pressable onPress={closeCategoryModal} style={{ padding: 10 }}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>{t.cancel}</Text>
                </Pressable>
                <Pressable onPress={handleAddCategory} style={{ padding: 10, backgroundColor: colors.accent, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{editingCategory ? (t.save || 'Save') : t.confirm}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {macroGoalsOpen && <MacroGoalsDialog colors={colors} onClose={() => setMacroGoalsOpen(false)} />}
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} mode="view" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 40,
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 0,
    overflow: 'hidden',
  },
  unit: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  dropdownTrigger: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dropdownTriggerPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 2,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.96,
  },
  btnText: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '800',
    textAlign: 'center',
  },
});
