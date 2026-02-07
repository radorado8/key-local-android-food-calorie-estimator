import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from 'react-native';

import { useTranslation } from '../hooks/useTranslation';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WeightDialog({ visible, onCancel, onConfirm, colors }) {
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const hasNavBar = Platform.OS === 'android' && insets.bottom > 30;

  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [visible]);

  const submit = () => {
    const parsed = parseFloat(String(value).replace(',', '.'));
    const grams = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
    onConfirm?.(grams);
  };

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : (hasNavBar ? 'height' : undefined)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: currentColors.card === 'rgba(255,255,255,0.06)' ? '#161B22' : currentColors.card, borderColor: currentColors.border }]}>
          <Text style={[styles.title, { color: currentColors.text }]}>{t.weightTitle}</Text>
          <Text style={[styles.subtitle, { color: currentColors.muted }]}>
            {t.weightSubtitle}
          </Text>

          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder={t.weightPlaceholder}
              placeholderTextColor={currentColors.muted}
              keyboardType="numeric"
              inputMode="numeric"
              style={[styles.input, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, color: currentColors.text }]}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <Text style={[styles.unit, { color: currentColors.muted }]}>g</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: currentColors.elemBg, borderColor: currentColors.elemBorder, borderWidth: 1 }, pressed && styles.btnPressed]} onPress={onCancel}>
              <Text style={[styles.btnText, { color: currentColors.text }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: currentColors.accent }, pressed && styles.btnPressed]} onPress={submit}>
              <Text style={[styles.btnText, { color: currentColors.card === '#FFFFFF' ? '#FFF' : '#000' }]}>{t.confirm}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 420,
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  row: {
    marginTop: 12,
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
    fontWeight: '700',
  },
  unit: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    backgroundColor: '#2DD4BF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.95,
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
  },
});
