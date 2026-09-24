import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { AI_PROVIDERS } from '../config/aiProviders';
import { activateApiKey, deleteApiKey, listApiKeys, saveApiKey } from '../utils/apiKeys';
import { getFriendlyError } from '../api/backend';

export default function ApiKeySettings({ colors, children }) {
  const t = useTranslation();
  const { aiProvider, setAiProvider, claudeVoiceProvider, setClaudeVoiceProvider } = useSettings();
  const [index, setIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [editor, setEditor] = useState(null);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const showError = error => {
    const friendly = getFriendlyError(error, t);
    Alert.alert(friendly.title, friendly.message);
  };
  const run = async task => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try { setIndex(await task()); return true; }
    catch (error) {
      // A keychain cleanup error may happen after the index was already committed.
      try { setIndex(await listApiKeys()); } catch { }
      showError(error);
      return false;
    }
    finally { operation.current = false; setBusy(false); }
  };
  useEffect(() => { run(listApiKeys); }, []);
  const close = () => { if (!operation.current) { setEditor(null); setSecret(''); setName(''); setShowSecret(false); } };
  const edit = entry => {
    setEditor(entry || { provider: aiProvider });
    setName(entry?.name || '');
    setSecret('');
    setShowSecret(false);
  };
  const providerLabel = AI_PROVIDERS.find(item => item.id === aiProvider)?.label;
  const entries = index?.keys.filter(key => key.provider === aiProvider) || [];
  const button = { backgroundColor: colors.elemBg, borderColor: colors.elemBorder };
  const label = { color: colors.text };
  const save = async () => {
    if (await run(() => saveApiKey({ ...editor, name, secret }))) close();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, label]}>{t.aiProviderTitle}</Text>
      <View style={styles.row}>
        {AI_PROVIDERS.map(provider => (
          <Pressable key={provider.id} accessibilityRole="radio" accessibilityState={{ selected: aiProvider === provider.id }} disabled={busy}
            onPress={() => setAiProvider(provider.id)} style={[styles.provider, button, aiProvider === provider.id && { borderColor: colors.accent }]}>
            <Text style={{ color: aiProvider === provider.id ? colors.accent : colors.text, fontWeight: '700' }}>{provider.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t.aiPrivacyHint}</Text>
      <Text style={[styles.subtitle, label]}>{providerLabel} · {t.aiKeysTitle}</Text>
      {!index && !busy && <Pressable onPress={() => run(listApiKeys)} style={[styles.button, button]}><Text style={label}>{t.aiReloadKeys}</Text></Pressable>}
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!index && entries.length === 0 && <Text style={{ color: colors.muted }}>{t.aiNoKeys}</Text>}
      {entries.map(entry => (
        <View key={entry.id} style={[styles.keyRow, button]}>
          <Pressable disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: index.active[aiProvider] === entry.id }}
            accessibilityLabel={entry.name} onPress={() => run(() => activateApiKey(aiProvider, entry.id))} style={[styles.row, { flex: 1, paddingVertical: 12 }]}>
            <Ionicons name={index.active[aiProvider] === entry.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[label, { fontWeight: '600' }]}>{entry.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{index.active[aiProvider] === entry.id ? t.aiActiveKey : '••••••••'}</Text>
            </View>
          </Pressable>
          <Pressable disabled={busy} accessibilityLabel={t.aiEditKey + ' ' + entry.name} onPress={() => edit(entry)} style={styles.icon}><Ionicons name="pencil-outline" size={21} color={colors.accent} /></Pressable>
          <Pressable disabled={busy} accessibilityLabel={t.delete + ' ' + entry.name} style={styles.icon}
            onPress={() => Alert.alert(t.delete, t.aiDeleteKey, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: () => run(() => deleteApiKey(entry.id)) }])}>
            <Ionicons name="trash-outline" size={21} color="#EF4444" />
          </Pressable>
        </View>
      ))}
      <Pressable disabled={busy || !index} onPress={() => edit(null)} style={[styles.button, button]}>
        <Ionicons name="add" size={21} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '700' }}>{t.aiAddKey}</Text>
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{t.aiKeysHint}</Text>
      {children}
      {aiProvider === 'claude' && <>
        <Text style={[styles.subtitle, label]}>{t.aiVoiceTitle}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t.aiVoiceHint}</Text>
        <View style={styles.row}>
          {[{ id: 'none', label: t.aiVoiceOff }, ...AI_PROVIDERS.filter(item => item.id !== 'claude')].map(provider => (
            <Pressable key={provider.id} accessibilityRole="radio" accessibilityState={{ selected: claudeVoiceProvider === provider.id }}
              onPress={() => setClaudeVoiceProvider(provider.id)} style={[styles.provider, button, claudeVoiceProvider === provider.id && { borderColor: colors.accent }]}>
              <Text style={{ color: claudeVoiceProvider === provider.id ? colors.accent : colors.text }}>{provider.label}</Text>
            </Pressable>
          ))}
        </View>
      </>}
      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <View style={[styles.dialog, { backgroundColor: colors.modalBg }]}>
              <Text style={[styles.title, label]}>{providerLabel} · {editor?.id ? t.aiEditKey : t.aiAddKey}</Text>
              <Text style={label}>{t.aiKeyName}</Text>
              <TextInput autoFocus value={name} onChangeText={setName} maxLength={80} editable={!busy} style={[styles.input, button, label]} placeholder={t.aiKeyName} placeholderTextColor={colors.muted} />
              <Text style={label}>{t.apiKeyLabel}</Text>
              <View style={[styles.row, styles.input, button]}>
                <TextInput value={secret} onChangeText={setSecret} secureTextEntry={!showSecret} autoCapitalize="none" autoCorrect={false} spellCheck={false} editable={!busy}
                  style={[label, { flex: 1, minHeight: 44 }]} placeholder={editor?.id ? t.aiKeepKey : t.apiKeyPlaceholder} placeholderTextColor={colors.muted} />
                <Pressable onPress={() => setShowSecret(value => !value)} accessibilityLabel={t.apiKeyLabel} style={styles.icon}><Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} /></Pressable>
              </View>
              <View style={styles.row}>
                <Pressable disabled={busy} onPress={close} style={[styles.button, button, { flex: 1 }]}><Text style={label}>{t.cancel}</Text></Pressable>
                <Pressable disabled={busy || (!editor?.id && !secret.trim())} onPress={save} style={[styles.button, { flex: 1, backgroundColor: colors.accent, opacity: busy || (!editor?.id && !secret.trim()) ? 0.5 : 1 }]}><Text style={{ color: '#052E2B', fontWeight: '700' }}>{busy ? '…' : t.save}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800' }, subtitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  provider: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 6 },
  keyRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingLeft: 10 },
  icon: { padding: 12 }, button: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }, modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  dialog: { borderRadius: 22, padding: 20, gap: 14 }, input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, fontSize: 16 },
});
