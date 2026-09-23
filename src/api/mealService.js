import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const LOCAL_MEALS_KEY = 'meals.v1';

// Internal memory cache for local meals to support "real-time" updates via callbacks
let localMealsCache = [];
let localListeners = [];
let cacheInitialized = false;
let initPromise = null;

async function initLocalCache() {
    if (cacheInitialized) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            const raw = await AsyncStorage.getItem(LOCAL_MEALS_KEY);
            localMealsCache = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(localMealsCache)) throw new Error('Invalid meal storage');
            cacheInitialized = true;
        } catch (error) {
            initPromise = null;
            console.error('Failed to init local cache', error);
            throw error;
        }
    })();
    return initPromise;
}

function notifyLocalListeners() {
    localListeners.forEach(cb => cb(localMealsCache));
}

async function saveLocalCache() {
    await AsyncStorage.setItem(LOCAL_MEALS_KEY, JSON.stringify(localMealsCache));
    notifyLocalListeners();
}

export async function createMeal(meal) {
    await initLocalCache();
    const previousMeals = localMealsCache;
    const mealToSave = {
        ...meal,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: meal.timestamp ? new Date(meal.timestamp).toISOString() : new Date().toISOString(),
    };

    localMealsCache = [mealToSave, ...localMealsCache];
    try {
        await saveLocalCache();
    } catch (error) {
        localMealsCache = previousMeals;
        throw error;
    }
    return mealToSave;
}

export async function importMeals(meals) {
    await initLocalCache();
    if (!Array.isArray(meals)) throw new Error('Invalid meals import');
    const now = Date.now();
    const importedMeals = meals.map((meal, index) => ({
        ...meal,
        id: `${now}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: meal.timestamp ? new Date(meal.timestamp).toISOString() : new Date().toISOString(),
        imported: true,
    }));
    const previousMeals = localMealsCache;
    localMealsCache = [...importedMeals, ...localMealsCache];
    try {
        await saveLocalCache();
    } catch (error) {
        localMealsCache = previousMeals;
        throw error;
    }
    return importedMeals.length;
}

export async function updateMeal(id, patch) {
    await initLocalCache();
    const previousMeals = localMealsCache;
    localMealsCache = localMealsCache.map(m => m.id === id ? { ...m, ...patch } : m);
    try {
        await saveLocalCache();
    } catch (error) {
        localMealsCache = previousMeals;
        throw error;
    }
}

export async function deleteMeal(id) {
    await initLocalCache();
    const previousMeals = localMealsCache;
    localMealsCache = localMealsCache.filter(m => m.id !== id);
    try {
        await saveLocalCache();
    } catch (error) {
        localMealsCache = previousMeals;
        throw error;
    }
}

export async function clearAllMeals(protectedImageUris = []) {
    await initLocalCache();
    const deletedCount = localMealsCache.length;
    const protectedImages = new Set(protectedImageUris.filter(Boolean));
    const mealPhotoPrefix = `${FileSystem.documentDirectory}meal_photos/`;
    const imageUris = [...new Set(localMealsCache
        .map(meal => meal.imageUri)
        .filter(uri => typeof uri === 'string' && uri.startsWith(mealPhotoPrefix) && !protectedImages.has(uri)))];
    const previousMeals = localMealsCache;
    localMealsCache = [];
    try {
        await saveLocalCache();
    } catch (error) {
        localMealsCache = previousMeals;
        throw error;
    }
    const imageResults = await Promise.allSettled(
        imageUris.map(async uri => {
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) return false;
            await FileSystem.deleteAsync(uri, { idempotent: true });
            return true;
        })
    );
    const deletedImageCount = imageResults.filter(result => result.status === 'fulfilled' && result.value).length;
    return { deletedCount, deletedImageCount };
}

export async function getAllMeals() {
    await initLocalCache();
    return [...localMealsCache];
}

export function subscribeToMeals(useLocalStorageIgnored, callback) {
    // Initial load
    initLocalCache().then(() => {
        callback(localMealsCache);
    });

    localListeners.push(callback);
    return () => {
        localListeners = localListeners.filter(l => l !== callback);
    };
}
