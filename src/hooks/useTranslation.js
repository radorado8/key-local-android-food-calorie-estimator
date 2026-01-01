import { useSettings } from '../state/SettingsContext';
import { translations } from '../i18n/translations';

export function useTranslation() {
    const { language } = useSettings();
    const currentLanguage = translations[language] ? language : 'sk';
    return translations[currentLanguage];
}
