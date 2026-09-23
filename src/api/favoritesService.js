import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { upgradeUsdaFavoriteNames } from '../utils/usdaFavoriteNames';

const LOCAL_FAVORITES_KEY = 'favorites.v1';
const FAVORITE_LISTS_KEY = 'favorites.lists.v1';
const FAVORITES_MIGRATION_BACKUP_KEY = 'favorites.backup.preLists.v1';
const DEFAULT_LIST_ID = 'default';

let localFavoritesCache = [];
let localListsCache = [];
let favoriteListeners = [];
let listListeners = [];
let cacheInitialized = false;
let initPromise = null;

const defaultList = () => ({ id: DEFAULT_LIST_ID, name: 'Obľúbené', createdAt: new Date().toISOString() });

async function initLocalCache() {
  if (cacheInitialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const [favoritesRaw, listsRaw] = await Promise.all([
        AsyncStorage.getItem(LOCAL_FAVORITES_KEY),
        AsyncStorage.getItem(FAVORITE_LISTS_KEY),
      ]);
      const parsedFavorites = favoritesRaw ? JSON.parse(favoritesRaw) : [];
      const parsedLists = listsRaw ? JSON.parse(listsRaw) : [];
      if (!Array.isArray(parsedFavorites)) throw new Error('Invalid favorites storage');
      if (listsRaw && !Array.isArray(parsedLists)) throw new Error('Invalid favorite lists storage');
      if (!parsedFavorites.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
        throw new Error('Invalid favorite item storage');
      }
      const needsListMigration = parsedFavorites.some(item => !item.listId);
      const needsDefaultList = parsedLists.length === 0;
      localFavoritesCache = parsedFavorites;
      localListsCache = needsDefaultList ? [defaultList()] : parsedLists;
      // Migration: every existing favorite belongs to the original list.
      localFavoritesCache = localFavoritesCache.map(item => ({ ...item, listId: item.listId || DEFAULT_LIST_ID }));
      const migrationWrites = [];
      const translatedFavorites = upgradeUsdaFavoriteNames(localFavoritesCache);
      const needsNameMigration = translatedFavorites.some((food, index) => food !== localFavoritesCache[index]);
      if (needsNameMigration) {
        const backupKey = 'favorites.backup.preUsdaSlovakNames.v1';
        if (!(await AsyncStorage.getItem(backupKey)) && favoritesRaw) {
          migrationWrites.push([backupKey, favoritesRaw]);
        }
        localFavoritesCache = translatedFavorites;
      }
      if (needsListMigration) {
        const existingBackup = await AsyncStorage.getItem(FAVORITES_MIGRATION_BACKUP_KEY);
        if (!existingBackup && favoritesRaw) migrationWrites.push([FAVORITES_MIGRATION_BACKUP_KEY, favoritesRaw]);
      }
      if (needsListMigration || needsNameMigration) migrationWrites.push([LOCAL_FAVORITES_KEY, JSON.stringify(localFavoritesCache)]);
      if (needsDefaultList) migrationWrites.push([FAVORITE_LISTS_KEY, JSON.stringify(localListsCache)]);
      if (migrationWrites.length > 0) await AsyncStorage.multiSet(migrationWrites);
      cacheInitialized = true;
    } catch (error) {
      initPromise = null;
      console.error('Failed to init favorites cache', error);
      throw error;
    }
  })();
  return initPromise;
}

function notifyFavorites() { favoriteListeners.forEach(cb => cb([...localFavoritesCache])); }
function notifyLists() { listListeners.forEach(cb => cb([...localListsCache])); }
async function saveFavorites() {
  await AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(localFavoritesCache));
  notifyFavorites();
}
async function saveLists() {
  await AsyncStorage.setItem(FAVORITE_LISTS_KEY, JSON.stringify(localListsCache));
  notifyLists();
}
async function saveFavoritesAndLists() {
  await AsyncStorage.multiSet([
    [LOCAL_FAVORITES_KEY, JSON.stringify(localFavoritesCache)],
    [FAVORITE_LISTS_KEY, JSON.stringify(localListsCache)],
  ]);
  notifyFavorites();
  notifyLists();
}
function makeId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

export async function addFavorite(meal, listId = DEFAULT_LIST_ID) {
  await initLocalCache();
  const previousFavorites = localFavoritesCache;
  const favorite = {
    id: makeId('fav'), createdAt: new Date().toISOString(), name: meal.name,
    calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
    weight_g: meal.weight_g || null, imageUri: meal.imageUri || null,
    categoryId: meal.categoryId || null,
    listId: localListsCache.some(list => list.id === listId) ? listId : DEFAULT_LIST_ID,
  };
  localFavoritesCache = [favorite, ...localFavoritesCache];
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
  return favorite;
}

export async function updateFavorite(id, patch) {
  await initLocalCache();
  const previousFavorites = localFavoritesCache;
  localFavoritesCache = localFavoritesCache.map(f => f.id === id ? { ...f, ...patch } : f);
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
}

export async function removeFavorite(id) {
  await initLocalCache();
  const previousFavorites = localFavoritesCache;
  localFavoritesCache = localFavoritesCache.filter(f => f.id !== id);
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
}

export async function createFavoriteList(name) {
  await initLocalCache();
  const cleanedName = String(name || '').trim().slice(0, 60);
  if (!cleanedName) throw new Error('List name is required');
  const previousLists = localListsCache;
  const list = { id: makeId('list'), name: cleanedName, createdAt: new Date().toISOString() };
  localListsCache = [...localListsCache, list];
  try { await saveLists(); } catch (error) { localListsCache = previousLists; throw error; }
  return list;
}

export async function renameFavoriteList(id, name) {
  await initLocalCache();
  if (id === DEFAULT_LIST_ID) return;
  const cleanedName = String(name || '').trim().slice(0, 60);
  if (!cleanedName) throw new Error('List name is required');
  const previousLists = localListsCache;
  localListsCache = localListsCache.map(list => list.id === id ? { ...list, name: cleanedName } : list);
  try { await saveLists(); } catch (error) { localListsCache = previousLists; throw error; }
}

export async function deleteFavoriteList(id) {
  await initLocalCache();
  if (id === DEFAULT_LIST_ID) throw new Error('The default list cannot be deleted');
  const previousFavorites = localFavoritesCache;
  const previousLists = localListsCache;
  localFavoritesCache = localFavoritesCache.filter(item => item.listId !== id);
  localListsCache = localListsCache.filter(list => list.id !== id);
  try {
    await saveFavoritesAndLists();
  } catch (error) {
    localFavoritesCache = previousFavorites;
    localListsCache = previousLists;
    throw error;
  }
}

export async function clearFavoriteList(id) {
  await initLocalCache();
  const previousFavorites = localFavoritesCache;
  localFavoritesCache = localFavoritesCache.filter(item => item.listId !== id);
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
}

export async function clearCategoryFromFavorites(categoryId) {
  await initLocalCache();
  const previousFavorites = localFavoritesCache;
  localFavoritesCache = localFavoritesCache.map(f => f.categoryId === categoryId ? { ...f, categoryId: null } : f);
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
}

export function subscribeFavorites(callback) {
  initLocalCache().then(() => callback([...localFavoritesCache]));
  favoriteListeners.push(callback);
  return () => { favoriteListeners = favoriteListeners.filter(listener => listener !== callback); };
}

export function subscribeFavoriteLists(callback) {
  initLocalCache().then(() => callback([...localListsCache]));
  listListeners.push(callback);
  return () => { listListeners = listListeners.filter(listener => listener !== callback); };
}

export async function getFavoriteImageUris() {
  await initLocalCache();
  return [...new Set(localFavoritesCache.map(item => item.imageUri).filter(Boolean))];
}

async function exportImage(uri) {
  if (!uri || uri.startsWith('data:')) return uri || null;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch { return null; }
}

async function importImage(dataUri, itemId) {
  const imageMatch = typeof dataUri === 'string'
    ? dataUri.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i)
    : null;
  if (!imageMatch) return null;
  const folder = `${FileSystem.documentDirectory}favorite_images/`;
  const extension = imageMatch[1].toLowerCase() === 'image/png' ? 'png'
    : imageMatch[1].toLowerCase() === 'image/webp' ? 'webp'
      : imageMatch[1].toLowerCase() === 'image/gif' ? 'gif'
        : 'jpg';
  const temporaryUri = `${FileSystem.cacheDirectory}favorite_import_${itemId}.${extension}`;
  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    await FileSystem.writeAsStringAsync(temporaryUri, imageMatch[2], { encoding: FileSystem.EncodingType.Base64 });
    const compressed = await manipulateAsync(
      temporaryUri,
      [{ resize: { width: 600 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    const uri = `${folder}${itemId}.jpg`;
    await FileSystem.moveAsync({ from: compressed.uri, to: uri });
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    return uri;
  } catch (error) {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => {});
    console.warn('Favorite image could not be restored', error);
    return null;
  }
}

export async function exportFavoriteList(listId) {
  await initLocalCache();
  const list = localListsCache.find(item => item.id === listId);
  if (!list) throw new Error('List not found');
  const favorites = await Promise.all(localFavoritesCache.filter(item => item.listId === listId)
    .map(async item => ({ ...item, imageUri: await exportImage(item.imageUri) })));
  return { format: 'calories-ai-favorites', version: 1, exportedAt: new Date().toISOString(), list: { name: list.name }, favorites };
}

export async function importFavoriteList(payload, language = 'en') {
  await initLocalCache();
  if (payload?.format !== 'calories-ai-favorites' || !Array.isArray(payload?.favorites)) throw new Error('Invalid favorites file');
  const localizedListName = payload.list?.names?.[language] || payload.list?.names?.en || payload.list?.name;
  const list = await createFavoriteList(localizedListName || 'Importované obľúbené');
  const imported = [];
  for (const raw of payload.favorites) {
    const id = makeId('fav');
    const imageUri = await importImage(raw.imageUri, id);
    imported.push({ id, listId: list.id, createdAt: raw.createdAt || new Date().toISOString(),
      name: String(raw.names?.[language] || raw.names?.en || raw.name || 'Jedlo').slice(0, 100), calories: Number(raw.calories) || 0,
      protein: Number(raw.protein) || 0, carbs: Number(raw.carbs) || 0, fat: Number(raw.fat) || 0,
      weight_g: Number(raw.weight_g) || null, categoryId: raw.categoryId || null, imageUri });
  }
  const previousFavorites = localFavoritesCache;
  localFavoritesCache = [...upgradeUsdaFavoriteNames(imported), ...localFavoritesCache];
  try { await saveFavorites(); } catch (error) { localFavoritesCache = previousFavorites; throw error; }
  return { list, count: imported.length };
}
