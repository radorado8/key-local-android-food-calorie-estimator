import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const GEMINI_API_KEY = 'gemini_api_key';

export async function getGeminiKey() {
    if (Platform.OS === 'web') {
        // SecureStore doesn't work on web, use localStorage or empty
        return localStorage.getItem(GEMINI_API_KEY);
    }
    return await SecureStore.getItemAsync(GEMINI_API_KEY);
}

export async function setGeminiKey(key) {
    if (Platform.OS === 'web') {
        localStorage.setItem(GEMINI_API_KEY, key);
        return;
    }
    return await SecureStore.setItemAsync(GEMINI_API_KEY, key);
}

export async function deleteGeminiKey() {
    if (Platform.OS === 'web') {
        localStorage.removeItem(GEMINI_API_KEY);
        return;
    }
    return await SecureStore.deleteItemAsync(GEMINI_API_KEY);
}
