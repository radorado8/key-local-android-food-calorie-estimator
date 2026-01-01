import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_MEALS_KEY = 'meals.v1';

// Internal memory cache for local meals to support "real-time" updates via callbacks
let localMealsCache = [];
let localListeners = [];

async function initLocalCache() {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_MEALS_KEY);
        localMealsCache = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Failed to init local cache', e);
        localMealsCache = [];
    }
}

function notifyLocalListeners() {
    localListeners.forEach(cb => cb(localMealsCache));
}

function saveLocalCache() {
    AsyncStorage.setItem(LOCAL_MEALS_KEY, JSON.stringify(localMealsCache)).catch(err => {
        console.error('Failed to save meals locally', err);
    });
    notifyLocalListeners();
}

export async function createMeal(meal) {
    const mealToSave = {
        ...meal,
        id: Date.now().toString(),
        timestamp: meal.timestamp ? new Date(meal.timestamp).toISOString() : new Date().toISOString(),
    };

    localMealsCache = [mealToSave, ...localMealsCache];
    saveLocalCache();
    return mealToSave;
}

export async function updateMeal(id, patch) {
    localMealsCache = localMealsCache.map(m => m.id === id ? { ...m, ...patch } : m);
    saveLocalCache();
}

export async function deleteMeal(id) {
    localMealsCache = localMealsCache.filter(m => m.id !== id);
    saveLocalCache();
}

export async function getAllMeals() {
    if (localMealsCache.length === 0) {
        await initLocalCache();
    }
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
