import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSettings } from '../state/SettingsContext';
import { getLocalModel, importLocalModel, deleteLocalModel } from '../api/localModel';

export default function LocalModelSettings({ colors }) {
  const { language } = useSettings();
  const sk = language === 'sk' || language === 'cs';
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { getLocalModel().then(setFiles).catch(error => Alert.alert('Local AI', error.message)); }, []);
  const run = async task => {
    if (busy) return;
    setBusy(true);
    try { await task(); setFiles(await getLocalModel()); }
    catch (error) { Alert.alert('Local AI', error.message); }
    finally { setBusy(false); }
  };
  const pick = projector => run(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: false });
    if (!result.canceled) await importLocalModel(result.assets[0], projector);
  });
  const button = (label, onPress) => <Pressable disabled={busy} onPress={onPress} style={{ borderWidth: 1, borderColor: colors.elemBorder, backgroundColor: colors.elemBg, padding: 12, borderRadius: 12, opacity: busy ? 0.5 : 1 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{label}</Text></Pressable>;
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.muted }}>{sk ? 'Experimentálna analýza priamo v telefóne. Bez API kľúča. Importuj model GGUF; na fotografie aj zodpovedajúci mmproj. Hlas zatiaľ nie je podporovaný.' : 'Experimental on-device analysis. No API key. Import a GGUF model and its matching mmproj for photos. Voice is not supported yet.'}</Text>
    <Text style={{ color: colors.text }}>{files.modelName || (sk ? 'Model nie je importovaný' : 'No model imported')}</Text>
    {button(sk ? 'Importovať model GGUF' : 'Import GGUF model', () => pick(false))}
    <Text style={{ color: colors.text }}>{files.projectorName || (sk ? 'Obrazový projektor nie je importovaný' : 'No image projector imported')}</Text>
    {button(sk ? 'Importovať obrazový projektor' : 'Import image projector', () => pick(true))}
    {busy && <ActivityIndicator color={colors.accent} />}
    {!!files.model && button(sk ? 'Vymazať lokálne modely' : 'Delete local models', () => Alert.alert('Local AI', sk ? 'Vymazať model aj projektor?' : 'Delete model and projector?', [{ text: sk ? 'Zrušiť' : 'Cancel' }, { text: sk ? 'Vymazať' : 'Delete', style: 'destructive', onPress: () => run(deleteLocalModel) }]))}
  </View>;
}
