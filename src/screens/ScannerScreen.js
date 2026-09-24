import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  BackHandler,
  ScrollView,
  AppState,
  Animated,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AnalysisLoader from '../components/AnalysisLoader';
import DailySummary from '../components/DailySummary';
import WeightDialog from '../components/WeightDialog';
import { useSettings } from '../state/SettingsContext';
import { analyzeFood, analyzeFoodDescriptionInput, getFriendlyError } from '../api/backend';
import NutritionResultCard from '../components/NutritionResultCard';
import { subscribeToMeals, createMeal } from '../api/mealService';
import { getAppConfig } from '../config/appConfig';
import { useTranslation } from '../hooks/useTranslation';
import { Audio } from 'expo-av';

const MAX_RECORDING_DURATION_MS = 30_000;
const ANALYSIS_IMAGE_MAX_WIDTH = 1024;
const ANALYSIS_IMAGE_COMPRESSION = 0.75;
const MIN_ANALYSIS_DISPLAY_MS = 900;

async function keepAnalysisVisible(startedAt) {
  const remaining = MIN_ANALYSIS_DISPLAY_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

// Keep the image passed to JavaScript and Gemini bounded. Camera and gallery
// originals can be several megabytes; passing them straight to Base64 duplicates
// their memory use and makes the upload needlessly large.
async function prepareImageForAnalysis(asset) {
  if (!asset?.uri) throw new Error('Chýba fotografia na analýzu.');

  const optimized = await manipulateAsync(
    asset.uri,
    [{ resize: { width: ANALYSIS_IMAGE_MAX_WIDTH } }],
    {
      compress: ANALYSIS_IMAGE_COMPRESSION,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!optimized.base64) throw new Error('Nepodarilo sa pripraviť fotografiu na analýzu.');

  return {
    ...asset,
    uri: optimized.uri,
    width: optimized.width,
    height: optimized.height,
    mimeType: 'image/jpeg',
    base64: optimized.base64,
  };
}

export default function ScannerScreen({ navigation, route }) {
  const t = useTranslation();
  const { dailyGoal, aiModel, aiProvider, claudeVoiceProvider, language, theme, useLocalStorage, saveFoodImages, autoSaveEnabled, autoSaveSeconds } = useSettings();
  const insets = useSafeAreaInsets();
  const audioRecordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMillis, setRecordingDurationMillis] = useState(0);

  // Track handled actions
  const lastActionTimestampRef = useRef(0);

  const colors = theme === 'light'
    ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)', btn: '#0D94881A', btnText: '#0D9488' }
    : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)', btn: '#CFFAFE', btnText: '#000000' };

  const didLongPressRef = useRef(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightDialogAction, setWeightDialogAction] = useState(null); // 'gallery' | 'camera'

  const [status, setStatus] = useState('idle'); // idle | analyzing | result
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [todayMealCount, setTodayMealCount] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [capturedUri, setCapturedUri] = useState(null);
  const [analysisInput, setAnalysisInput] = useState(null);
  const [showFoodInput, setShowFoodInput] = useState(false);
  const [foodDescription, setFoodDescription] = useState('');
  const [recordedAudio, setRecordedAudio] = useState(null);
  const foodInputRef = useRef(null);
  const recordingPulse = useRef(new Animated.Value(0.45)).current;
  const recordingLimitReachedRef = useRef(false);

  const stopRecording = useCallback(async () => {
    const recording = audioRecordingRef.current;
    if (!recording) return null;

    try {
      const status = await recording.getStatusAsync();
      if (status.isRecording) await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const audio = uri ? { uri, mimeType: 'audio/mp4' } : null;
      if (audio) setRecordedAudio(audio);
      return audio;
    } finally {
      audioRecordingRef.current = null;
      setIsRecording(false);
      setRecordingDurationMillis(0);
    }
  }, []);

  const pickingRef = useRef(false);

  // Built-in Camera state
  const cameraRef = useRef(null);
  const analysisActiveRef = useRef(false);
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [weightForCamera, setWeightForCamera] = useState(null);

  const shutterOpacity = useRef(new Animated.Value(0)).current;
  const { DAILY_ANALYSIS_LIMIT } = getAppConfig();

  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(Animated.sequence([
        Animated.timing(recordingPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(recordingPulse, { toValue: 0.35, duration: 550, useNativeDriver: true }),
      ]));
      animation.start();
      return () => animation.stop();
    }
    recordingPulse.setValue(0.45);
  }, [isRecording, recordingPulse]);

  useEffect(() => {
    if (!isRecording) {
      recordingLimitReachedRef.current = false;
      return;
    }

    const updateDuration = async () => {
      const status = await audioRecordingRef.current?.getStatusAsync();
      const duration = status?.durationMillis || 0;
      setRecordingDurationMillis(duration);
      if (duration >= MAX_RECORDING_DURATION_MS && !recordingLimitReachedRef.current) {
        recordingLimitReachedRef.current = true;
        await stopRecording();
      }
    };
    updateDuration().catch(() => {});
    const timer = setInterval(() => updateDuration().catch(() => {}), 150);
    return () => clearInterval(timer);
  }, [isRecording, stopRecording]);

  // Handle Quick Actions
  useEffect(() => {
    if (route.params?.action && route.params?.timestamp) {
      const { action, timestamp } = route.params;

      if (lastActionTimestampRef.current === timestamp) return;
      lastActionTimestampRef.current = timestamp;

      // Small delay to ensure mount/navigation stability
      setTimeout(() => {
        if (action === 'camera') {
          takePhoto(null);
        } else if (action === 'camera_weight') {
          openWeightDialog('camera');
        }
      }, 600);
    }
  }, [route.params]);

  // Midnight refresh check
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      if (current.getDate() !== now.getDate()) {
        setNow(current);
      }
    }, 60000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const current = new Date();
        if (current.getDate() !== now.getDate()) {
          setNow(current);
        }
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [now]);

  // Check for pending ImagePicker results (handles activity recreation)
  useEffect(() => {
    const checkPending = async () => {
      try {
        const pendingResult = await ImagePicker.getPendingResultAsync();
        if (pendingResult && pendingResult.assets?.[0]) {
          const asset = await prepareImageForAnalysis(pendingResult.assets[0]);
          await analyzePickedImage(asset, null);
        }
      } catch (err) {
        // Ignore - no pending result
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPending();
      }
    });

    // Also check on mount
    checkPending();

    return () => sub.remove();
  }, []);

  useEffect(() => {
    return subscribeToMeals(useLocalStorage, (meals) => {
      const today = new Date(); // Re-evaluated when 'now' triggers re-run
      today.setHours(0, 0, 0, 0);

      const todayMeals = (meals || []).filter(m => {
        const d = m.dateObj || (m.timestamp ? new Date(m.timestamp) : new Date());
        const dCopy = new Date(d);
        dCopy.setHours(0, 0, 0, 0);
        return dCopy.getTime() === today.getTime();
      });

      setTodayMealCount(todayMeals.length);
      const cals = todayMeals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      setTodayCalories(cals);
    });
  }, [useLocalStorage, now]); // Re-subscribe when day changes to force re-calc

  useLayoutEffect(() => {
    if (status !== 'idle') {
      navigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    } else {
      // Restore explicit styles because 'undefined' overwrites default screenOptions with nothing
      navigation.setOptions({
        tabBarStyle: {
          backgroundColor: theme === 'light' ? '#FFFFFF' : '#0B0F14',
          borderTopColor: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
          height: 60 + (Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom),
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom,
          display: 'flex',
        },
      });
    }
  }, [status, navigation, theme, insets]);


  useEffect(() => {
    const onBackPress = () => {
      if (status === 'result' || status === 'analyzing') {
        setStatus('idle');
        setResult(null);
        setCapturedUri(null);
        analysisActiveRef.current = false;
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [status]);

  const checkLimit = () => {
    if (todayMealCount >= DAILY_ANALYSIS_LIMIT) {
      Alert.alert(
        t.analyzeLimitTitle,
        t.analyzeLimitMsg.replace('70', DAILY_ANALYSIS_LIMIT)
      );
      return false;
    }
    return true;
  };

  const openFoodInput = () => {
    setFoodDescription('');
    setRecordedAudio(null);
    setShowFoodInput(true);
    setTimeout(() => foodInputRef.current?.focus(), 250);
  };

  const closeFoodInput = async () => {
    if (isRecording) await stopRecording().catch(() => {});
    setShowFoodInput(false);
    setFoodDescription('');
    setRecordedAudio(null);
  };

  const toggleRecording = async () => {
    if (!isRecording && aiProvider === 'claude' && claudeVoiceProvider === 'none') {
      Alert.alert('Claude', t.aiVoiceHint);
      return;
    }
    try {
      if (isRecording) {
        await stopRecording();
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t.errorTitle || 'Chyba', t.microphonePermissionMissing || 'Povoľ prístup k mikrofónu a skús znova.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      setRecordedAudio(null);
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      audioRecordingRef.current = recording;
      recordingLimitReachedRef.current = false;
      setRecordingDurationMillis(0);
      setIsRecording(true);
    } catch (err) {
      Alert.alert(t.errorTitle || 'Chyba', err?.message || 'Nahrávanie sa nepodarilo spustiť.');
    }
  };

  const analyzeFoodInput = async () => {
    if (!checkLimit()) return;
    let audio = recordedAudio;
    if (isRecording) {
      audio = await stopRecording();
    }

    const description = foodDescription.trim();
    if (!description && !audio?.uri) return;

    const analysisId = Date.now().toString();
    currentAnalysisIdRef.current = analysisId;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const analysisStartedAt = Date.now();

    setShowFoodInput(false);
    setCapturedUri(null);
    setAnalysisInput(audio?.uri
      ? { type: 'audio' }
      : { type: 'text', text: description });
    setStatus('analyzing');
    setIsRetrying(false);
    setResult(null);
    analysisActiveRef.current = true;

    try {
      const needsInlineAudio = aiProvider === 'gemini' || (aiProvider === 'claude' && claudeVoiceProvider === 'gemini');
      const audioBase64 = audio?.uri && needsInlineAudio
        ? await FileSystem.readAsStringAsync(audio.uri, { encoding: 'base64' })
        : null;
      const data = await analyzeFoodDescriptionInput({
        aiProvider,
        claudeVoiceProvider,
        audioUri: audio?.uri,
        text: description,
        audioBase64,
        audioMimeType: audio?.mimeType,
        language,
        aiModel,
        signal: controller.signal,
      });
      if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;
      await keepAnalysisVisible(analysisStartedAt);
      if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;
      setResult(data);
      setStatus('result');
    } catch (err) {
      if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;
      if (err.name === 'AbortError' || err.message === 'Aborted') return;
      await keepAnalysisVisible(analysisStartedAt);
      if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;
      setStatus('idle');
      analysisActiveRef.current = false;
      const friendly = getFriendlyError(err, t);
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setRecordedAudio(null);
    }
  };

  const ensurePermissions = async (action) => {
    try {
      if (action === 'camera') {
        const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();
        if (currentStatus !== 'granted') {
          const { status: requestStatus } = await ImagePicker.requestCameraPermissionsAsync();
          if (requestStatus !== 'granted') throw new Error(t.cameraPermissionMissing);
        }
      } else {
        const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (currentStatus !== 'granted') {
          const { status: requestStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (requestStatus !== 'granted') throw new Error(t.cameraPermissionMissing);
        }
      }
    } catch (err) {
      console.error('Permission Error:', err);
      throw new Error(`Chyba povolení: ${err.message}`);
    }
  };

  const [isRetrying, setIsRetrying] = useState(false);

  // Track active analysis ID to prevent race conditions
  const currentAnalysisIdRef = useRef(null);
  const abortControllerRef = useRef(null); // Controller for network cancellation

  const analyzePickedImage = async (asset, weightG) => {
    if (!asset?.base64) {
      throw new Error('Chýba base64 obrázka (ImagePicker).');
    }

    // Generate unique ID for this session
    const analysisId = Date.now().toString();
    currentAnalysisIdRef.current = analysisId;

    // Create new abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort any previous
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const mimeType = asset.mimeType || 'image/jpeg';

    setCapturedUri(asset.uri);
    setAnalysisInput(null);
    setStatus('analyzing');
    setIsRetrying(false);
    setResult(null);
    analysisActiveRef.current = true;

    let attempts = 0;
    const maxAttempts = 2; // Try once, then retry once

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const data = await analyzeFood({
          aiProvider,
          base64Data: asset.base64,
          mimeType,
          aiModel,
          weightG,
          language,
          signal: controller.signal // Pass signal
        });

        // Race condition check: Ensure this is still the active analysis
        if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) {
          console.log('Analysis cancelled or superseded, ignoring result.');
          return;
        }

        setResult(data);
        setStatus('result');
        return; // Success, exit function
      } catch (err) {
        // Race condition check OR Abort check
        if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;

        // If aborted, stop
        if (err.name === 'AbortError' || err.message === 'Aborted') {
          console.log('Analysis aborted.');
          return;
        }

        // Check if we should retry
        const isJsonError = err.message && (err.message.includes('JSON Parse error') || err.message.includes('Unexpected token'));
        const isNetworkError = err.message && (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('Empty response'));

        if ((isJsonError || isNetworkError) && attempts < maxAttempts) {
          console.log(`Attempt ${attempts} failed, retrying... Error: ${err.message}`);
          setIsRetrying(true);
          // Wait a bit before retrying
          await new Promise(r => setTimeout(r, 1500));

          // Re-check after wait
          if (currentAnalysisIdRef.current !== analysisId || !analysisActiveRef.current) return;
          continue; // Retry loop
        }

        // If we ran out of attempts or it's a fatal error
        setStatus('idle');
        setResult(null);
        setCapturedUri(null);
        setIsRetrying(false);
        throw err; // Re-throw to be caught by calling function which clears pickingRef
      }
    }
  };

  const pickFromGallery = async (weightG = null) => {
    if (!checkLimit()) return;
    if (pickingRef.current) return;

    let timeoutId;
    try {
      pickingRef.current = true;
      timeoutId = setTimeout(() => {
        if (pickingRef.current) pickingRef.current = false;
      }, 15000);

      await ensurePermissions('gallery');

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: false, // More stable to read manually
      });

      if (!res.canceled && res.assets?.[0]) {
        const asset = await prepareImageForAnalysis(res.assets[0]);
        await analyzePickedImage(asset, weightG);
      }
    } catch (err) {
      // Handle ActivityResultLauncher error (occurs after Android config changes)
      const errMsg = String(err?.message || err || '');
      if (errMsg.includes('ActivityResultLauncher') || errMsg.includes('unregistered')) {
        Alert.alert(
          t.restartRequiredTitle || 'Reštart potrebný',
          t.restartRequiredMessage || 'Prosím, reštartujte aplikáciu a skúste znova.',
          [{ text: 'OK' }]
        );
      } else {
        // Re-throw other errors
        console.error('Gallery error:', err);
        Alert.alert(t.error || 'Chyba', errMsg);
      }
    } finally {
      clearTimeout(timeoutId);
      pickingRef.current = false;
    }
  };

  const takePhoto = async (weightG = null) => {
    if (!checkLimit()) return;
    setWeightForCamera(weightG);

    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Chyba', t.cameraPermissionMissing);
        return;
      }
    }

    setShowCamera(true);
  };



  const handleCapture = async () => {
    if (!cameraRef.current || pickingRef.current) return;

    try {
      pickingRef.current = true;

      // Gentle Shutter Animation (No waiting)
      Animated.sequence([
        Animated.timing(shutterOpacity, { toValue: 1, duration: 20, useNativeDriver: true }),
        Animated.timing(shutterOpacity, { toValue: 0, duration: 100, useNativeDriver: true })
      ]).start();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        shutterSound: false,
      });

      setShowCamera(false);

      const asset = await prepareImageForAnalysis(photo);
      await analyzePickedImage(asset, weightForCamera);

    } catch (err) {
      console.error('Capture Error:', err);
      const friendly = getFriendlyError(err, t);
      Alert.alert(friendly.title, friendly.message);
      setShowCamera(false);
    } finally {
      pickingRef.current = false;
      setWeightForCamera(null);
    }
  };

  // ... (weight dialog handlers unchanged from original logic scope, keeping them embedded if needed or assuming they follow) ...
  const openWeightDialog = (action) => {
    setWeightDialogAction(action);
    setWeightDialogOpen(true);
  };

  const closeWeightDialog = () => {
    setWeightDialogOpen(false);
    setWeightDialogAction(null);
  };

  const handleWeightConfirm = async (weightG) => {
    const action = weightDialogAction;
    closeWeightDialog();
    setTimeout(async () => {
      try {
        if (action === 'camera') {
          await takePhoto(weightG);
        } else {
          await pickFromGallery(weightG);
        }
      } catch (err) {
        const friendly = getFriendlyError(err, t);
        Alert.alert(friendly.title, friendly.message);
      }
    }, 150);
  };

  const makeActionHandlers = (action) => ({
    onLongPress: () => {
      didLongPressRef.current = true;
      openWeightDialog(action);
    },
    delayLongPress: 600,
    onPress: async () => {
      if (didLongPressRef.current) {
        didLongPressRef.current = false;
        return;
      }
      try {
        if (action === 'camera') {
          await takePhoto(null);
        } else {
          await pickFromGallery(null);
        }
      } catch (err) {
        const friendly = getFriendlyError(err, t);
        Alert.alert(friendly.title, friendly.message);
      }
    },
  });

  // Conditionally render exclusive screens
  if (status === 'analyzing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContainer}>
          <AnalysisLoader
            imageUri={capturedUri}
            inputType={analysisInput?.type}
            inputText={analysisInput?.text}
            t={t}
            isRetrying={isRetrying}
            onCancel={() => {
              // Abort network request immediately
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }
              analysisActiveRef.current = false;
              setStatus('idle');
              setCapturedUri(null);
              setAnalysisInput(null);
              setIsRetrying(false);
              // Force clear lock just in case
              pickingRef.current = false;
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'result' && result) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <NutritionResultCard
            data={result}
            imageUri={capturedUri}
            todayCalories={todayCalories}
            dailyGoal={dailyGoal}
            saving={saving}
            theme={theme}
            colors={colors}
            onChange={setResult}
            autoSaveEnabled={autoSaveEnabled}
            autoSaveSeconds={autoSaveSeconds}
            onReset={() => {
              setStatus('idle');
              setResult(null);
              setCapturedUri(null);
            }}
            onSave={async () => {
              try {
                setSaving(true);

                let finalImageUri = null;
                if (capturedUri && saveFoodImages) {
                  const dir = FileSystem.documentDirectory + 'meal_photos/';
                  const dirInfo = await FileSystem.getInfoAsync(dir);
                  if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                  }

                  // Resize and compress
                  const manipulated = await manipulateAsync(
                    capturedUri,
                    [{ resize: { width: 600 } }],
                    { compress: 0.7, format: SaveFormat.JPEG }
                  );

                  const filename = `meal_${Date.now()}.jpg`;
                  const permPath = dir + filename;

                  await FileSystem.moveAsync({
                    from: manipulated.uri,
                    to: permPath
                  });
                  finalImageUri = permPath;
                }

                const meal = {
                  name: String(result.name || '').trim() || 'Jedlo',
                  calories: Math.round(Number(result.calories)),
                  protein: Math.round(Number(result.protein)),
                  carbs: Math.round(Number(result.carbs)),
                  fat: Math.round(Number(result.fat)),
                  weight_g: Number(result.weight_g),
                  confidence: Number(result.confidence ?? 0.5),
                  imageUri: finalImageUri,
                };
                await createMeal(meal, useLocalStorage);
                setStatus('idle');
                setResult(null);
                setCapturedUri(null);
              } catch (err) {
                const friendly = getFriendlyError(err, { operation: 'create_meal' });
                Alert.alert(friendly.title, friendly.message);
              } finally {
                setSaving(false);
              }
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }



  // Idle state (Dashboard)
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
      <ScrollView contentContainerStyle={styles.container} indicatorStyle={theme === 'light' ? 'black' : 'white'}>
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {t.heroTitle} <Text style={[styles.heroAccent, { color: colors.accent }]}>{t.heroAccent}</Text>
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DailySummary
            dailyGoal={dailyGoal}
            colors={colors}
            useLocalStorage={useLocalStorage}
            onPress={() => navigation.navigate('History')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.sectionFrame, { backgroundColor: colors.btn, borderColor: colors.border }, pressed && styles.sectionFramePressed]}
            onPress={openFoodInput}
          >
            <Text style={[styles.sectionTitle, { color: colors.btnText }]}>{t.addFoodTextOrVoice || t.addFoodLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.bigBtn, { backgroundColor: colors.btn, borderColor: colors.border }, pressed && styles.bigBtnPressed]}
            {...makeActionHandlers('gallery')}
          >
            <Text style={[styles.hint, { color: theme === 'light' ? colors.muted : 'rgba(0,0,0,0.55)' }]}>{t.holdToWeigh}</Text>
            <Text style={[styles.bigBtnText, { color: colors.btnText }]}>{t.galleryShort}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.bigBtn, { backgroundColor: colors.btn, borderColor: colors.border }, pressed && styles.bigBtnPressed]}
            {...makeActionHandlers('camera')}
          >
            <Text style={[styles.hint, { color: theme === 'light' ? colors.muted : 'rgba(0,0,0,0.55)' }]}>{t.holdToWeigh}</Text>
            <Text style={[styles.bigBtnText, { color: colors.btnText }]}>{t.cameraShort}</Text>
          </Pressable>
        </View>

      </ScrollView>

      <Modal
        visible={showFoodInput}
        animationType="fade"
        transparent
        onRequestClose={closeFoodInput}
      >
        <KeyboardAvoidingView
          style={styles.foodInputOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFoodInput} />
          <View style={[styles.foodInputDialog, { backgroundColor: theme === 'light' ? colors.card : '#161B22', borderColor: colors.border }]}>
            <Text style={[styles.foodInputTitle, { color: colors.text }]}>{t.addFoodTextOrVoice || t.addFoodLabel}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Claude'}
              {aiProvider === 'claude' && claudeVoiceProvider !== 'none' ? ` · ${t.aiVoiceTitle}: ${claudeVoiceProvider === 'gemini' ? 'Gemini' : 'OpenAI'}` : ''}
            </Text>
            <TextInput
              ref={foodInputRef}
              value={foodDescription}
              onChangeText={setFoodDescription}
              placeholder={t.foodDescriptionPlaceholder || 'napr. rožok s maslom'}
              placeholderTextColor={colors.muted}
              style={[styles.foodTextInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              multiline
              returnKeyType="done"
              onSubmitEditing={analyzeFoodInput}
            />

            <View style={styles.recordingRow}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.microphoneButton,
                  { backgroundColor: isRecording ? '#DC2626' : colors.btn, borderColor: colors.border },
                  pressed && styles.bigBtnPressed,
                ]}
                onPress={toggleRecording}
              >
                <Text style={[styles.microphoneIcon, { color: isRecording ? '#FFFFFF' : colors.btnText }]}>●</Text>
                <Text style={[styles.microphoneText, { color: isRecording ? '#FFFFFF' : colors.btnText }]}>
                  {isRecording ? (t.stopRecording || 'Zastaviť nahrávanie') : (t.microphone || 'Mikrofón')}
                </Text>
              </Pressable>
              {isRecording && (
                <View style={styles.waveform} accessibilityLabel={t.recording || 'Nahrávanie'}>
                  {[0.55, 0.9, 0.7, 1, 0.6].map((height, index) => (
                    <Animated.View
                      key={index}
                      style={[styles.waveBar, { height: 28 * height, opacity: recordingPulse, backgroundColor: '#DC2626' }]}
                    />
                  ))}
                  <Text style={[styles.recordingTimer, { color: colors.muted }]}>
                    {`${Math.min(30, Math.floor(recordingDurationMillis / 1000))} / 30 s`}
                  </Text>
                </View>
              )}
              {!isRecording && recordedAudio && (
                <View style={[styles.recordingStatus, { backgroundColor: colors.btn, borderColor: colors.border }]}>
                  <Text style={[styles.audioReady, { color: colors.accent }]}>{t.audioReady || 'Nahrávka pripravená'}</Text>
                </View>
              )}
              {!isRecording && !recordedAudio && (
                <View style={[styles.recordingStatus, { backgroundColor: theme === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.10)', borderColor: colors.border }]}>
                  <Text style={[styles.audioReady, { color: colors.muted }]}>{t.noRecording || 'No recording'}</Text>
                </View>
              )}
            </View>

            <View style={styles.foodInputActions}>
              <Pressable style={[styles.dialogButton, { borderColor: colors.border }]} onPress={closeFoodInput}>
                <Text style={[styles.dialogButtonText, { color: colors.muted }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.dialogButton,
                  styles.dialogConfirmButton,
                  { backgroundColor: colors.accent, opacity: (foodDescription.trim() || recordedAudio || isRecording) ? 1 : 0.45 },
                  pressed && styles.bigBtnPressed,
                ]}
                disabled={!foodDescription.trim() && !recordedAudio && !isRecording}
                onPress={analyzeFoodInput}
              >
                <Text style={[styles.dialogButtonText, { color: '#FFFFFF' }]}>{t.confirm}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCamera}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraOverlay}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'black', opacity: shutterOpacity, pointerEvents: 'none', zIndex: 1 }
              ]}
            />
            <View style={styles.cameraControls}>
              <Pressable
                style={styles.camBtnSecondary}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.camBtnText}>{t.cancel}</Text>
              </Pressable>

              <Pressable
                style={styles.camBtnMain}
                onPress={handleCapture}
              >
                <View style={styles.camBtnInner} />
              </Pressable>

              <Pressable
                style={styles.camBtnSecondary}
                onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
              >
                <Text style={styles.camBtnText}>{flash === 'on' ? t.flashOn : t.flashOff}</Text>
              </Pressable>
            </View>
          </CameraView>
        </View>
      </Modal>

      <WeightDialog
        visible={weightDialogOpen}
        colors={colors}
        onCancel={closeWeightDialog}
        onConfirm={handleWeightConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
  },
  heroAccent: {
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  actions: {
    marginTop: 1,
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeader: {
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionFrame: {
    width: '100%',
    paddingVertical: 12, // Increased slightly for better click area/visual weight if full width
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionFramePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800', // Matches other headers
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // sectionLine removed
  bigBtn: {
    flex: 1,
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  bigBtnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.96,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.55)',
    fontWeight: '600',
  },
  analyzingTitle: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
  },
  analyzingDesc: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  bigBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    zIndex: 999,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  camBtnMain: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  camBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  camBtnSecondary: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    minWidth: 90,
    alignItems: 'center',
  },
  camBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodInputOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  foodInputDialog: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    elevation: 10,
  },
  foodInputTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  foodTextInput: {
    minHeight: 94,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  recordingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  microphoneButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 15,
  },
  microphoneIcon: {
    fontSize: 22,
    lineHeight: 22,
  },
  microphoneText: {
    fontWeight: '800',
    fontSize: 14,
  },
  waveform: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recordingTimer: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  audioReady: {
    fontWeight: '700',
    fontSize: 13,
  },
  recordingStatus: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  foodInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dialogConfirmButton: {
    borderWidth: 0,
  },
  dialogButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
