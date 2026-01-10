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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

function toNumber(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

import { useTranslation } from '../hooks/useTranslation';

export default function MealEditDialog({ visible, initialMeal, onCancel, onSave, colors, mode = 'edit' }) {
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

  const nameRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    setName(String(initialMeal?.name || ''));
    setCalories(String(initialMeal?.calories ?? (mode === 'add' ? '0' : '')));
    setProtein(String(initialMeal?.protein ?? (mode === 'add' ? '0' : '')));
    setCarbs(String(initialMeal?.carbs ?? (mode === 'add' ? '0' : '')));
    setFat(String(initialMeal?.fat ?? (mode === 'add' ? '0' : '')));
    setWeightG(String(initialMeal?.weight_g ?? (mode === 'add' ? '0' : '')));
    setImageUri(initialMeal?.imageUri || null);

    if (initialMeal?.timestamp) {
      const t = initialMeal.timestamp;
      // Handle Firestore Timestamp (has toDate) or ISO string/number
      const d = t.toDate ? t.toDate() : new Date(t);
      if (!isNaN(d.getTime())) {
        setDate(d);
      } else {
        setDate(new Date());
      }
    } else if (mode === 'add') {
      setDate(new Date()); // Reset to now
    }

    const t = setTimeout(() => {
      try {
        nameRef.current?.focus?.();
      } catch {
        // ignore
      }
    }, 250);

    return () => clearTimeout(t);
  }, [visible, initialMeal]);

  const parsed = useMemo(() => {
    return {
      name: String(name || '').trim(),
      calories: toNumber(calories),
      protein: toNumber(protein),
      carbs: toNumber(carbs),
      fat: toNumber(fat),
      weight_g: toNumber(weightG),
      weight_g: toNumber(weightG),
      timestamp: date.toISOString(), // Always send timestamp (edited or new)
      imageUri: imageUri,
    };
  }, [name, calories, protein, carbs, fat, weightG, date, mode, imageUri]);

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: currentColors.card === 'rgba(255,255,255,0.06)' ? '#161B22' : currentColors.card, borderColor: currentColors.border }]}>
          {(imageUri) && (
            <View style={{ marginBottom: 16 }}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: currentColors.elemBg }}
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
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </Pressable>
            </View>
          )}

          <Text style={[styles.title, { color: currentColors.text }]}>
            {mode === 'add' ? t.addMealTitle : t.editMealTitle}
          </Text>

          {(mode === 'add' || mode === 'edit') && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: currentColors.muted, marginBottom: 4 }]}>{t.dateLabel || 'Date & Time'}</Text>

              {Platform.OS === 'android' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setShowDatePicker('date')}
                    style={[styles.input, { flex: 1, backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, paddingVertical: 12, alignItems: 'center' }]}
                  >
                    <Text style={{ color: currentColors.text, fontWeight: '700' }}>
                      {date.toLocaleDateString()}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowDatePicker('time')}
                    style={[styles.input, { flex: 1, backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, paddingVertical: 12, alignItems: 'center' }]}
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
              <Text style={[styles.btnPrimaryText, { color: currentColors.card === '#FFFFFF' ? '#FFF' : '#000' }]}>
                {mode === 'add' ? t.add : t.save}
              </Text>
            </Pressable>
          </View>

          {!valid ? <Text style={[styles.hint, { color: currentColors.muted }]}>{t.validationError}</Text> : null}
        </View>
      </View>
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
    backgroundColor: '#0B0F14',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 8,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    gap: 10,
    marginTop: 8,
  },
  gridItem: {
    width: '48%',
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
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
