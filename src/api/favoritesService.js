import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_FAVORITES_KEY = 'favorites.v1';

let localFavoritesCache = [];
let localListeners = [];

async function initLocalCache() {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY);
        localFavoritesCache = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Failed to init favorites cache', e);
        localFavoritesCache = [];
    }
}

function notifyLocalListeners() {
    localListeners.forEach(cb => cb(localFavoritesCache));
}

function saveLocalCache() {
    AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(localFavoritesCache)).catch(err => {
        console.error('Failed to save favorites locally', err);
    });
    notifyLocalListeners();
}

export async function addFavorite(meal) {
    const favorite = {
        id: Date.now().toString(),
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        weight_g: meal.weight_g || null,
        imageUri: meal.imageUri || null,
    };

    localFavoritesCache = [favorite, ...localFavoritesCache];
    saveLocalCache();
    return favorite;
}

export async function updateFavorite(id, patch) {
    localFavoritesCache = localFavoritesCache.map(f => f.id === id ? { ...f, ...patch } : f);
    saveLocalCache();
}

export async function removeFavorite(id) {
    localFavoritesCache = localFavoritesCache.filter(f => f.id !== id);
    saveLocalCache();
}

export function subscribeFavorites(callback) {
    initLocalCache().then(() => {
        callback(localFavoritesCache);
    });

    localListeners.push(callback);
    return () => {
        localListeners = localListeners.filter(l => l !== callback);
    };
}
