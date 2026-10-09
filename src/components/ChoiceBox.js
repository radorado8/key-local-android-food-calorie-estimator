import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChoiceBox({ value, options, onChange, colors, label, disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      onPress={() => setOpen(true)} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: colors.text, flex: 1 }}>{selected?.label}</Text>
      <Ionicons name="chevron-down" size={18} color={colors.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable accessible={false} onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.55)' }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.modalBg, borderRadius: 16, padding: 12 }}>
          <Text style={{ color: colors.muted, padding: 12 }}>{label}</Text>
          {options.map(option => <Pressable key={option.value} accessibilityRole="button"
            accessibilityState={{ selected: option.value === value }} onPress={() => { setOpen(false); onChange(option.value); }}
            style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {option.icon && <Ionicons name={option.icon} size={22} color={colors.accent} />}
            <Text style={{ color: colors.text, flex: 1 }}>{option.label}</Text>
            {option.value === value && <Ionicons name="checkmark" size={20} color={colors.accent} />}
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </>;
}
