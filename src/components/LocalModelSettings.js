import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSettings } from '../state/SettingsContext';
import { getLocalModel, importLocalModel, deleteLocalModel, setLocalOutputLanguage } from '../api/localModel';

const DOWNLOADS = [
  { name: 'Gemma 4 E2B · Q4_K_M', modelSize: '3.43 GB', projectorSize: '987 MB', repo: 'lmstudio-community/gemma-4-E2B-it-GGUF', model: 'gemma-4-E2B-it-Q4_K_M.gguf', projector: 'mmproj-gemma-4-E2B-it-BF16.gguf' },
  { name: 'Boba 0.8B · Q4_K_M', modelSize: '529 MB', projectorSize: '205 MB', repo: 'Doses-AI/boba-0.8b-food-GGUF', model: 'sift-q4km.gguf', projector: 'sift-mmproj-f16.gguf' },
];

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
  const openLink = url => Linking.openURL(url).catch(() => Alert.alert('Local AI', sk ? 'Odkaz sa nepodarilo otvoriť.' : 'Could not open the link.'));
  const button = (label, onPress) => <Pressable disabled={busy} onPress={onPress} style={{ borderWidth: 1, borderColor: colors.elemBorder, backgroundColor: colors.elemBg, padding: 12, borderRadius: 12, opacity: busy ? 0.5 : 1 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{label}</Text></Pressable>;
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.muted }}>{sk ? 'Experimentálna analýza priamo v telefóne. Bez API kľúča. Importuj model GGUF; na fotografie aj zodpovedajúci mmproj. Hlas zatiaľ nie je podporovaný.' : 'Experimental on-device analysis. No API key. Import a GGUF model and its matching mmproj for photos. Voice is not supported yet.'}</Text>
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{sk ? 'Jazyk výsledkov lokálneho modelu' : 'Local model result language'}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['en', sk ? 'Angličtina' : 'English'], ['app', sk ? 'Jazyk aplikácie' : 'App language']].map(([value, label]) => {
          const selected = (files.outputLanguage || 'en') === value;
          return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={() => run(() => setLocalOutputLanguage(value))} style={{ flex: 1, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.elemBorder, backgroundColor: colors.elemBg, padding: 12, borderRadius: 12, justifyContent: 'center' }}>
            <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: selected ? '700' : '400', textAlign: 'center' }}>{label}</Text>
          </Pressable>;
        })}
      </View>
      <Text style={{ color: colors.muted }}>{sk ? 'Angličtina je predvolená. Jazyk rozhrania zostáva nezmenený; názvy nových výsledkov sa ukladajú vo vybranom jazyku.' : 'English is the default. The interface language stays unchanged; new result names are saved in the selected language.'}</Text>
    </View>
    <Text style={{ color: colors.text }}>{files.modelName || (sk ? 'Model nie je importovaný' : 'No model imported')}</Text>
    {button(sk ? 'Importovať model GGUF' : 'Import GGUF model', () => pick(false))}
    <Text style={{ color: colors.text }}>{files.projectorName || (sk ? 'Obrazový projektor nie je importovaný' : 'No image projector imported')}</Text>
    {button(sk ? 'Importovať obrazový projektor' : 'Import image projector', () => pick(true))}
    {busy && <ActivityIndicator color={colors.accent} />}
    {!!files.model && button(sk ? 'Vymazať lokálne modely' : 'Delete local models', () => Alert.alert('Local AI', sk ? 'Vymazať model aj projektor?' : 'Delete model and projector?', [{ text: sk ? 'Zrušiť' : 'Cancel' }, { text: sk ? 'Vymazať' : 'Delete', style: 'destructive', onPress: () => run(deleteLocalModel) }]))}
    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.elemBorder, paddingTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{sk ? 'Stiahnuť modely z Hugging Face' : 'Download models from Hugging Face'}</Text>
      <Text style={{ color: colors.muted }}>{sk ? 'Stiahni súbory cez prehliadač do priečinka Stiahnuté / Downloads. Potom sa vráť sem a použi Importovať model GGUF a Importovať obrazový projektor. Na fotografie potrebuješ oba súbory z rovnakej dvojice.' : 'Download the files in your browser to Downloads. Then return here and use Import GGUF model and Import image projector. Photos require both files from the same pair.'}</Text>
      {DOWNLOADS.map(item => <View key={item.repo} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: colors.elemBorder, borderRadius: 12, backgroundColor: colors.elemBg }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
        <Text style={{ color: colors.muted }}>{sk ? 'Experimentálny model; presnosť závisí od jedla a jazyka.' : 'Experimental model; accuracy varies by food and language.'}</Text>
        {[['model', sk ? 'Stiahnuť model' : 'Download model', item.modelSize], ['projector', sk ? 'Stiahnuť obrazový projektor' : 'Download image projector', item.projectorSize]].map(([field, label, size]) => <Pressable key={field} accessibilityRole="link" onPress={() => openLink(`https://huggingface.co/${item.repo}/resolve/main/${item[field]}?download=true`)} style={{ paddingVertical: 10 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{label} · {size} ↗</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item[field]}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="link" onPress={() => openLink(`https://huggingface.co/${item.repo}`)} style={{ paddingVertical: 8 }}><Text style={{ color: colors.accent }}>{sk ? 'Podrobnosti modelu a licencia' : 'Model details and license'} ↗</Text></Pressable>
      </View>)}
      <Text style={{ color: colors.muted }}>{sk ? 'Import vytvorí kópiu v aplikácii, preto potrebuješ miesto aj na stiahnuté súbory, aj na ich kópiu. Po úspešnom importe môžeš súbory z Downloads vymazať.' : 'Import creates an app-owned copy, so allow storage for both the downloads and the copy. After a successful import you can delete the files from Downloads.'}</Text>
    </View>
  </View>;
}
