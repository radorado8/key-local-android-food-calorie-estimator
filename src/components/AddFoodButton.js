import React, { useState } from 'react';
import { Modal, Pressable, Text, View, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AddFoodButton({ colors, t, onManual, onCamera }) {
  const [mode, setMode] = useState('manual');
  const [open, setOpen] = useState(false);
  return <>
    <View style={{ position: 'absolute', right: 16, top: 16, flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.card }}>
      <Pressable accessibilityLabel={mode === 'manual' ? t.addMealTitle : t.cameraShort}
        onPress={() => { Keyboard.dismiss(); (mode === 'manual' ? onManual : onCamera)(); }} style={{ padding: 7 }}>
        <Ionicons name={mode === 'manual' ? 'add' : 'camera-outline'} size={24} color={colors.text} />
      </Pressable>
      <Pressable accessibilityLabel={t.addFoodMethod} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={{ paddingVertical: 10, paddingRight: 7 }}>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable accessible={false} onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.55)' }}>
        <View accessibilityViewIsModal style={{ padding: 16, borderRadius: 16, backgroundColor: colors.modalBg }}>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>{t.addFoodMethod}</Text>
          {[['manual', 'add', t.manualFood], ['camera', 'camera-outline', t.cameraShort]].map(([value, icon, label]) =>
            <Pressable key={value} accessibilityRole="button" onPress={() => { setMode(value); setOpen(false); }} style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
              <Ionicons name={icon} size={24} color={colors.accent} /><Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
              {mode === value && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </>;
}
