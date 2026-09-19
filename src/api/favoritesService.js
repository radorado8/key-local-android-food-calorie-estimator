import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_FAVORITES_KEY = 'favorites.v1';

let localFavoritesCache = [];
let localListeners = [];
let cacheInitialized = false;
let initPromise = null;

async function initLocalCache() {
    if (cacheInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const raw = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY);
            localFavoritesCache = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to init favorites cache', e);
            // Keep existing cache instead of wiping to empty
            if (localFavoritesCache.length === 0) {
                localFavoritesCache = [];
            }
        }
        cacheInitialized = true;
    })();

    return initPromise;
}

function notifyLocalListeners() {
    localListeners.forEach(cb => cb([...localFavoritesCache]));
}

function saveLocalCache() {
    const dataToSave = JSON.stringify(localFavoritesCache);
    AsyncStorage.setItem(LOCAL_FAVORITES_KEY, dataToSave).catch(err => {
        console.error('Failed to save favorites locally', err);
    });
    notifyLocalListeners();
}

export async function addFavorite(meal) {
    await initLocalCache();

    const favorite = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
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
    await initLocalCache();
    localFavoritesCache = localFavoritesCache.map(f => f.id === id ? { ...f, ...patch } : f);
    saveLocalCache();
}

export async function removeFavorite(id) {
    await initLocalCache();
    localFavoritesCache = localFavoritesCache.filter(f => f.id !== id);
    saveLocalCache();
}

export async function clearCategoryFromFavorites(categoryId) {
    await initLocalCache();
    let changed = false;
    localFavoritesCache = localFavoritesCache.map(f => {
        if (f.categoryId === categoryId) {
            changed = true;
            return { ...f, categoryId: null };
        }
        return f;
    });
    if (changed) saveLocalCache();
}

export function subscribeFavorites(callback) {
    initLocalCache().then(() => {
        callback([...localFavoritesCache]);
    });

    localListeners.push(callback);
    return () => {
        localListeners = localListeners.filter(l => l !== callback);
    };
}
