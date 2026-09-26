import { typography } from '../theme/palette';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Image,
  Animated,
  Keyboard,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { useTranslation } from '../hooks/useTranslation';

function toNumber(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export default function MealEditDialog({ visible, initialMeal, onCancel, onSave, colors, mode = 'edit', categories = [], imageStorageFolder = 'meal_photos' }) {
  const t = useTranslation();
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [weightG, setWeightG] = useState('');
  const [imageUri, setImageUri] = useState(null);

  // Date state for 'add' mode
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const nameRef = useRef(null);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    setName(String(initialMeal?.name || ''));
    setCalories(String(initialMeal?.calories ?? (mode === 'add' ? '0' : '')));
    setProtein(String(initialMeal?.protein ?? (mode === 'add' ? '0' : '')));
    setCarbs(String(initialMeal?.carbs ?? (mode === 'add' ? '0' : '')));
    setFat(String(initialMeal?.fat ?? (mode === 'add' ? '0' : '')));
    setWeightG(String(initialMeal?.weight_g ?? (mode === 'add' ? '0' : '')));
    setImageUri(initialMeal?.imageUri || null);
    setCategoryId(initialMeal?.categoryId || null);
    translateY.setValue(0);

    if (initialMeal?.timestamp) {
      const ts = initialMeal.timestamp;
      // Handle Firestore Timestamp (has toDate) or ISO string/number
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      if (!isNaN(d.getTime())) {
        setDate(d);
      } else {
        setDate(new Date());
      }
    } else if (mode === 'add') {
      setDate(new Date()); // Reset to now
    }

    const focusTimeout = setTimeout(() => {
      try {
        nameRef.current?.focus?.();
      } catch {
        // ignore
      }
    }, 250);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e) => {
      const keyboardHeight = e.endCoordinates.height;
      // Move dialog up by half of keyboard height
      Animated.timing(translateY, {
        toValue: -keyboardHeight / 2,
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: true,
      }).start();
    };

    const onKeyboardHide = () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: true,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onKeyboardShow);
    const subHide = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      clearTimeout(focusTimeout);
      subShow.remove();
      subHide.remove();
    };
  }, [visible, initialMeal]);

  const parsed = useMemo(() => {
    return {
      name: String(name || '').trim(),
      calories: toNumber(calories),
      protein: toNumber(protein),
      carbs: toNumber(carbs),
      fat: toNumber(fat),
      weight_g: toNumber(weightG),
      timestamp: date.toISOString(),
      imageUri: imageUri,
      categoryId: categoryId || null,
    };
  }, [name, calories, protein, carbs, fat, weightG, date, mode, imageUri, categoryId]);

  const valid =
    parsed.name.length > 0 &&
    parsed.name.length <= 100 &&
    [parsed.calories, parsed.protein, parsed.carbs, parsed.fat, parsed.weight_g].every((n) => Number.isFinite(n));

  const currentColors = colors || {
    bg: '#0B0F14',
    card: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    muted: 'rgba(255,255,255,0.7)',
    accent: '#2DD4BF',
    border: 'rgba(255,255,255,0.1)',
    elemBg: 'rgba(255,255,255,0.06)',
    elemBorder: 'rgba(255,255,255,0.12)',
  };

  const saveSelectedImage = async (uri) => {
    const folder = `${FileSystem.documentDirectory}${imageStorageFolder}/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const processed = await manipulateAsync(uri, [{ resize: { width: 800 } }], {
      compress: 0.75,
      format: SaveFormat.JPEG,
    });
    const destination = `${folder}${imageStorageFolder === 'favorite_images' ? 'favorite' : 'meal'}_${Date.now()}.jpg`;
    await FileSystem.moveAsync({ from: processed.uri, to: destination });
    setImageUri(destination);
  };

  const chooseImage = async (source) => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') return;
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) await saveSelectedImage(result.assets[0].uri);
    } catch (error) {
      console.error('Favorite image selection failed', error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent={true}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { backgroundColor: currentColors.card === 'rgba(255,255,255,0.06)' ? '#161B22' : currentColors.card, borderColor: currentColors.border, transform: [{ translateY }] }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(imageUri) && (
              <View style={{ marginBottom: 4 }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: 100, borderRadius: 12, backgroundColor: currentColors.elemBg }}
                  resizeMode="contain"
                />
                <Pressable
                  onPress={() => setImageUri(null)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 20,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)'
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={currentColors.danger} />
                </Pressable>
              </View>
            )}

            <View style={styles.imageActions}>
              <Pressable onPress={() => chooseImage('camera')} style={[styles.imageButton, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder }]}>
                <Ionicons name="camera-outline" size={18} color={currentColors.accent} />
                <Text style={{ color: currentColors.text, fontWeight: '700' }}>{t.cameraShort || 'Fotoaparát'}</Text>
              </Pressable>
              <Pressable onPress={() => chooseImage('gallery')} style={[styles.imageButton, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder }]}>
                <Ionicons name="images-outline" size={18} color={currentColors.accent} />
                <Text style={{ color: currentColors.text, fontWeight: '700' }}>{t.galleryShort || 'Galéria'}</Text>
              </Pressable>
            </View>

            <Text style={[styles.title, { color: currentColors.text }]}>
              {mode === 'add' ? t.addMealTitle : t.editMealTitle}
            </Text>

            {(mode === 'add' || mode === 'edit') && (
              <View style={{ marginBottom: 8 }}>
                <Text style={[styles.label, { color: currentColors.muted, marginBottom: 4 }]}>{t.dateLabel || 'Date & Time'}</Text>

                {Platform.OS === 'android' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => setShowDatePicker('date')}
                      style={[styles.input, { flex: 1, backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, paddingVertical: 8, alignItems: 'center' }]}
                    >
                      <Text style={{ color: currentColors.text, fontWeight: '700' }}>
                        {date.toLocaleDateString()}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDatePicker('time')}
                      style={[styles.input, { flex: 1, backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, paddingVertical: 8, alignItems: 'center' }]}
                    >
                      <Text style={{ color: currentColors.text, fontWeight: '700' }}>
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>

                    {!!showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode={showDatePicker} // 'date' or 'time'
                        display="default"
                        is24Hour={true}
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            // Merge existing date/time with selected part
                            const newDate = new Date(date);
                            if (showDatePicker === 'date') {
                              newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                            } else {
                              newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                            }
                            setDate(newDate);
                          }
                        }}
                      />
                    )}
                  </View>
                )}
              </View>
            )}

            <Text style={[styles.label, { color: currentColors.muted }]}>{t.nameLabel}</Text>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={setName}
              style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]}
              placeholder={t.mealNamePlaceholder}
              placeholderTextColor={currentColors.muted}
            />

            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={[styles.label, { color: currentColors.muted }]}>{t.calories}</Text>
                <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" inputMode="numeric" style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]} />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.label, { color: currentColors.muted }]}>{t.protein} (g)</Text>
                <TextInput value={protein} onChangeText={setProtein} keyboardType="numeric" inputMode="numeric" style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]} />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.label, { color: currentColors.muted }]}>{t.carbs} (g)</Text>
                <TextInput value={carbs} onChangeText={setCarbs} keyboardType="numeric" inputMode="numeric" style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]} />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.label, { color: currentColors.muted }]}>{t.fat} (g)</Text>
                <TextInput value={fat} onChangeText={setFat} keyboardType="numeric" inputMode="numeric" style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]} />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.label, { color: currentColors.muted }]}>{t.weightLabel} (g)</Text>
                <TextInput value={weightG} onChangeText={setWeightG} keyboardType="numeric" inputMode="numeric" style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]} />
              </View>
              {categories.length > 0 && (
                <View style={styles.gridItem}>
                  <Text style={[styles.label, { color: currentColors.muted }]}>{t.categoryLabel || 'Kategória'}</Text>
                  <Pressable
                    onPress={() => setShowCategoryPicker(true)}
                    style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  >
                    <Text style={{ color: categoryId ? currentColors.text : currentColors.muted, fontWeight: '700', fontSize: 13 }}>
                      {categoryId ? (categories.find(c => c.id === categoryId)?.label || '—') : (t.noCategory || 'Žiadna')}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={currentColors.muted} />
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, borderWidth: 1 }, pressed && styles.btnPressed]} onPress={onCancel}>
                <Text style={[styles.btnGhostText, { color: currentColors.text }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                disabled={!valid}
                style={({ pressed }) => [styles.btn, { backgroundColor: currentColors.accent }, pressed && styles.btnPressed, !valid && styles.btnDisabled]}
                onPress={() => onSave(parsed)}
              >
                <Text style={[styles.btnPrimaryText, { color: currentColors.onAccent }]}>
                  {mode === 'add' ? t.add : t.save}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }} onPress={() => setShowCategoryPicker(false)}>
            <View style={{ backgroundColor: currentColors.card === 'rgba(255,255,255,0.06)' ? '#161B22' : currentColors.card, borderRadius: 16, borderWidth: 1, borderColor: currentColors.border, maxHeight: '60%' }}>
              <ScrollView bounces={false}>
                <Pressable
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: currentColors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  onPress={() => { setCategoryId(null); setShowCategoryPicker(false); }}
                >
                  <Text style={{ color: !categoryId ? currentColors.accent : currentColors.text, fontWeight: '600', fontSize: 16 }}>{t.noCategory || 'Žiadna kategória'}</Text>
                  {!categoryId && <Ionicons name="checkmark" size={20} color={currentColors.accent} />}
                </Pressable>
                {categories.map(c => (
                  <Pressable
                    key={c.id}
                    style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: currentColors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    onPress={() => { setCategoryId(c.id); setShowCategoryPicker(false); }}
                  >
                    <Text style={{ color: categoryId === c.id ? currentColors.accent : currentColors.text, fontWeight: '600', fontSize: 16 }}>{c.label}</Text>
                    {categoryId === c.id && <Ionicons name="checkmark" size={20} color={currentColors.accent} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#0B0F14',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  title: { ...typography.sectionTitle,
    color: 'white',
    marginBottom: 4,
  },
  label: { ...typography.sectionTitle,
    color: 'rgba(255,255,255,0.75)',
    },
  input: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'white',
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  imageButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  gridItem: {
    width: '48%',
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2DD4BF',
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '900',
  },
  btnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnGhostText: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '800',
  },
  btnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
    opacity: 0.96,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  hint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
});
