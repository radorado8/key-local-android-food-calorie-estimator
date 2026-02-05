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
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportUserData, getFriendlyError } from '../api/backend';
import { getAllMeals, createMeal } from '../api/mealService';
import { getGeminiKey, setGeminiKey } from '../utils/secureStorage';
import TermsModal from '../components/TermsModal';

function clampDailyGoal(value) {
  if (!Number.isFinite(value)) return 2100;
  return Math.max(500, Math.min(10000, Math.round(value)));
}

// ... Dropdown component ... (omitted for brevity in replace, but context match will find the right place)
// Actually, I'll target the top of SettingsScreen component to add state, and top of file for import.
// This call handles BOTH if I can match multiple blocks? No, replace_file_content is single block.
// I'll do the import first, then the state.
// Wait, I can do this in TWO separate replace_file_content calls or one multi_replace.
// I'll use multi_replace for safety and efficiency.


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
  const { dailyGoal, setDailyGoal, aiModel, setAiModel, language, setLanguage, theme, userTheme, setTheme, useLocalStorage, setUseLocalStorage, analysisMode, setAnalysisMode, customModels, setCustomModels, saveFoodImages, setSaveFoodImages, showImagesInHistory, setShowImagesInHistory } = useSettings();

  const colors = theme === 'light'
    ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)', elemBg: '#F1F5F9', elemBorder: 'rgba(0,0,0,0.05)', modalBg: '#FFFFFF' }
    : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)', elemBg: 'rgba(255,255,255,0.06)', elemBorder: 'rgba(255,255,255,0.12)', modalBg: '#161B22' };

  const [dailyGoalInput, setDailyGoalInput] = useState(String(dailyGoal));
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    try {
      setImporting(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
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

      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 3) continue; // minimal valid row

        const dateStr = row[0]?.trim();
        const name = row[1]?.trim() || t.importedMealDefault;
        const cals = parseFloat(row[2] || '0');
        const prot = parseFloat(row[3] || '0');
        const carbs = parseFloat(row[4] || '0');
        const fat = parseFloat(row[5] || '0');
        const weight = parseFloat(row[6] || '0');

        let timestamp;
        try {
          timestamp = new Date(dateStr).toISOString();
        } catch {
          timestamp = new Date().toISOString();
        }

        const meal = {
          name,
          calories: cals,
          protein: prot,
          carbs: carbs,
          fat: fat,
          weight_g: weight,
          timestamp,
          imported: true
        };

        await createMeal(meal, true); // Force local storage
        importedCount++;
      }

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
      csvData = `${t.csvHeaderDate},${t.csvHeaderName},${t.csvHeaderCals},${t.csvHeaderProt},${t.csvHeaderCarbs},${t.csvHeaderFat},${t.csvHeaderWeight}\n`;

      // Rows
      meals.forEach(m => {
        const date = m.timestamp || new Date().toISOString();
        const name = (m.name || '').replace(/,/g, ' ');
        const cals = m.calories || 0;
        const p = m.protein || 0;
        const c = m.carbs || 0;
        const f = m.fat || 0;
        const w = m.weight_g || 0;
        csvData += `${date},${name},${cals},${p},${c},${f},${w}\n`;
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

  return (

    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
      <View style={styles.headerBlock}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.settingsTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
        </View>

        {/* 5. Analysis Mode */}
        <Dropdown
          label={t.analysisMode || "Analysis Mode"}
          hint={t.analysisModeHint}
          value={analysisMode}
          options={[
            { id: 'auto', label: t.modeAuto || "Auto (Key based)" },
            { id: 'cloud', label: t.modeCloud || "Cloud (Gemini)" },
            { id: 'local', label: t.modeLocal || "Offline (On-Device)" },
          ]}
          onSelect={setAnalysisMode}
          colors={colors}
        />

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

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4 }]}>{t.modelSource || 'Model Source:'}</Text>
          <Text
            style={{ color: colors.accent, fontSize: 13, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://github.com/google-coral/edgetpu/blob/master/test_data/mobilenet_v2_1.0_224_quant.tflite')}
          >
            Google Coral (MobileNet V2)
          </Text>

          <Text style={[styles.hint, { color: colors.muted, marginBottom: 4, marginTop: 12 }]}>{t.poweredBy || 'Powered by:'}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Expo • React Native • Fast TFLite • Gemini API
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
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
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
