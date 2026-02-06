import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
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
import { analyzeFood, getFriendlyError } from '../api/backend';
import NutritionResultCard from '../components/NutritionResultCard';
import { subscribeToMeals, createMeal } from '../api/mealService';
import { getAppConfig } from '../config/appConfig';
import { useTranslation } from '../hooks/useTranslation';

export default function ScannerScreen({ navigation, route }) {
  const t = useTranslation();
  const { dailyGoal, aiModel, language, theme, useLocalStorage, analysisMode, saveFoodImages } = useSettings();
  const insets = useSafeAreaInsets();

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

  const pickingRef = useRef(false);

  // Built-in Camera state
  const cameraRef = useRef(null);
  const analysisActiveRef = useRef(false);
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [weightForCamera, setWeightForCamera] = useState(null);
  const { DAILY_ANALYSIS_LIMIT } = getAppConfig();

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
          base64Data: asset.base64,
          mimeType,
          aiModel,
          weightG,
          language,
          analysisMode,
          imageUri: asset.uri,
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
        const asset = res.assets[0];
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64',
        });
        await analyzePickedImage({ ...asset, base64 }, weightG);
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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        shutterSound: false,
      });

      setShowCamera(false);

      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: 'base64',
      });

      await analyzePickedImage({ ...photo, base64 }, weightForCamera);

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
          <View style={[styles.sectionFrame, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t.addFoodLabel}</Text>
          </View>
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
});
