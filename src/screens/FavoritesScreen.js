import { typography } from '../theme/palette';
import React, { useDeferredValue, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
    Alert,
    SectionList,
    Pressable,
    StyleSheet,
    Text,
    View,
    Image,
    Keyboard,
    TextInput,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageView from "react-native-image-viewing";
import { Ionicons } from '@expo/vector-icons';
import { subscribeFavorites, subscribeFavoriteLists, removeFavorite, updateFavorite, addFavorite, createFavoriteList, renameFavoriteList, deleteFavoriteList, clearFavoriteList, exportFavoriteList, importFavoriteList } from '../api/favoritesService';
import { createMeal } from '../api/mealService';
import MealEditDialog from '../components/MealEditDialog';
import WeightDialog from '../components/WeightDialog';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { normalizeFoodSearchText, sortFoodSearchResults } from '../utils/foodSearch';
import usdaCommonFoods from '../data/usdaCommonFoods.json';

const EXPANDED_KEY = 'favorites.expandedCategories';
const ACTIVE_LIST_KEY = 'favorites.activeList';

export default function FavoritesScreen() {
    const t = useTranslation();
    const { theme, showImagesInHistory, useLocalStorage, foodCategories, language } = useSettings();
    const [favorites, setFavorites] = useState([]);
    const [favoriteLists, setFavoriteLists] = useState([]);
    const [activeListId, setActiveListId] = useState('default');
    const [listManagerOpen, setListManagerOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [renamingList, setRenamingList] = useState(null);
    const renameSaving = useRef(false);
    const [listBusy, setListBusy] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [weightDialogOpen, setWeightDialogOpen] = useState(false);
    const [weightItem, setWeightItem] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState({});
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const { colors } = useSettings();

    useEffect(() => {
        const unsub = subscribeFavorites((fetched) => {
            setFavorites(fetched);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeFavoriteLists(setFavoriteLists);
        AsyncStorage.getItem(ACTIVE_LIST_KEY).then(id => { if (id) setActiveListId(id); });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (favoriteLists.length && !favoriteLists.some(list => list.id === activeListId)) setActiveListId('default');
    }, [favoriteLists, activeListId]);

    useEffect(() => {
        if (!isSearching) return;
        const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 100);
        return () => clearTimeout(focusTimer);
    }, [isSearching]);

    const closeSearch = useCallback(() => {
        setSearchQuery('');
        setIsSearching(false);
        Keyboard.dismiss();
    }, []);

    const activeList = favoriteLists.find(list => list.id === activeListId) || favoriteLists[0];
    const closeListManager = () => {
        setRenamingList(null);
        setListManagerOpen(false);
        Keyboard.dismiss();
    };

    const handleRenameList = async () => {
        if (!renamingList?.name.trim() || renameSaving.current) return;
        renameSaving.current = true;
        setListBusy(true);
        try {
            await renameFavoriteList(renamingList.id, renamingList.name);
            setRenamingList(null);
            Keyboard.dismiss();
        } catch (error) {
            Alert.alert(t.errorTitle, error.message);
        } finally {
            renameSaving.current = false;
            setListBusy(false);
        }
    };
    const selectList = useCallback((id) => {
        setActiveListId(id);
        AsyncStorage.setItem(ACTIVE_LIST_KEY, id).catch(() => {});
        setListManagerOpen(false);
        setRenamingList(null);
        closeSearch();
    }, [closeSearch]);

    // Load persisted expanded/collapsed state
    useEffect(() => {
        AsyncStorage.getItem(EXPANDED_KEY).then(raw => {
            if (raw) {
                try { setExpandedCategories(JSON.parse(raw)); } catch {}
            }
        });
    }, []);

    const handleAddToLog = async (item) => {
        try {
            await createMeal({
                name: item.name,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                weight_g: item.weight_g,
                imageUri: item.imageUri,
                confidence: 1.0,
                timestamp: new Date().toISOString(),
            }, useLocalStorage);
            Alert.alert(t.addedToLog || '✅', t.addedToLogMsg || item.name);
        } catch (e) {
            Alert.alert(t.errorTitle, e.message || t.errorTitle);
        }
    };

    const handleAddToLogWithWeight = async (item, newWeightG) => {
        try {
            const origWeight = Number(item.weight_g);
            const hasOrigWeight = origWeight > 0;
            const ratio = hasOrigWeight ? newWeightG / origWeight : 1;

            await createMeal({
                name: item.name,
                calories: hasOrigWeight ? Math.round(Number(item.calories || 0) * ratio) : Number(item.calories || 0),
                protein: hasOrigWeight ? Math.round(Number(item.protein || 0) * ratio * 10) / 10 : Number(item.protein || 0),
                carbs: hasOrigWeight ? Math.round(Number(item.carbs || 0) * ratio * 10) / 10 : Number(item.carbs || 0),
                fat: hasOrigWeight ? Math.round(Number(item.fat || 0) * ratio * 10) / 10 : Number(item.fat || 0),
                weight_g: newWeightG,
                imageUri: item.imageUri,
                confidence: 1.0,
                timestamp: new Date().toISOString(),
            }, useLocalStorage);
            Alert.alert(t.addedToLog || '✅', t.addedToLogMsg || item.name);
        } catch (e) {
            Alert.alert(t.errorTitle, e.message || t.errorTitle);
        }
    };

    const handleDelete = (item) => {
        Alert.alert(t.removeFavoriteTitle || t.deleteMealTitle, t.removeFavoriteMsg || t.deleteMealMsg, [
            { text: t.cancel, style: 'cancel' },
            {
                text: t.delete,
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeFavorite(item.id);
                    } catch (e) {
                        Alert.alert(t.errorTitle, e.message || t.errorTitle);
                    }
                },
            },
        ]);
    };

    const toggleCategory = useCallback((catId) => {
        setExpandedCategories(prev => {
            const updated = { ...prev, [catId]: prev[catId] === false ? true : false };
            AsyncStorage.setItem(EXPANDED_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
        });
    }, []);

    const visibleFavorites = useMemo(() => favorites.filter(item => item.listId === (activeList?.id || 'default')), [favorites, activeList]);

    const searchIndex = useMemo(() => visibleFavorites
        .map(item => ({
            item,
            normalizedName: normalizeFoodSearchText(item.name),
            addedAt: Date.parse(item.createdAt || item.timestamp || '') || Number(item.id) || 0,
        }))
        .sort((a, b) => b.addedAt - a.addedAt), [visibleFavorites]);

    const searchResults = useMemo(() => {
        return sortFoodSearchResults(searchIndex, deferredSearchQuery).map(entry => entry.item);
    }, [deferredSearchQuery, searchIndex]);

    const sections = useMemo(() => {
        if (isSearching) return searchResults.length ? [{ categoryId: '__search__', title: null, data: searchResults }] : [];

        const uncategorized = visibleFavorites.filter(f => !f.categoryId);
        const categorized = new Map();

        for (const fav of visibleFavorites) {
            if (!fav.categoryId) continue;
            if (!categorized.has(fav.categoryId)) categorized.set(fav.categoryId, []);
            categorized.get(fav.categoryId).push(fav);
        }

        const result = [];

        // Uncategorized items first (no header needed, rendered directly)
        if (uncategorized.length > 0) {
            result.push({ categoryId: '__none__', title: null, data: uncategorized });
        }

        // Category sections (only if they have items)
        for (const cat of foodCategories) {
            const items = categorized.get(cat.id);
            if (items && items.length > 0) {
                result.push({ categoryId: cat.id, title: cat.label, data: items });
            }
        }

        return result;
    }, [visibleFavorites, foodCategories, isSearching, searchResults]);

    const handleCreateList = async () => {
        try {
            const list = await createFavoriteList(newListName);
            setNewListName('');
            selectList(list.id);
        } catch { Alert.alert(t.errorTitle || 'Chyba', t.listNameRequired || 'Zadaj názov zoznamu.'); }
    };

    const handleExportList = async () => {
        if (!activeList) return;
        try {
            setListBusy(true);
            const payload = await exportFavoriteList(activeList.id);
            const safeName = activeList.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'favorites';
            const uri = `${FileSystem.documentDirectory}${safeName}_${Date.now()}.calories-favorites.json`;
            await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload), { encoding: FileSystem.EncodingType.UTF8 });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json' });
        } catch (error) { Alert.alert(t.errorTitle || 'Chyba', error.message || 'Export zlyhal.'); }
        finally { setListBusy(false); }
    };

    const handleImportList = async () => {
        try {
            setListBusy(true);
            const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.[0]) return;
            const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
            const imported = await importFavoriteList(JSON.parse(raw), language);
            selectList(imported.list.id);
            Alert.alert(t.success || 'Hotovo', `${imported.count} ${t.importedMsg || 'položiek importovaných.'}`);
        } catch (error) { Alert.alert(t.errorTitle || 'Chyba', error.message || 'Import zlyhal.'); }
        finally { setListBusy(false); }
    };

    const handleInstallStarterList = async () => {
        try {
            setListBusy(true);
            const imported = await importFavoriteList(usdaCommonFoods, language);
            selectList(imported.list.id);
            Alert.alert(t.success || 'Hotovo', `Pridaný zoznam: ${imported.count} potravín.`);
        } catch (error) { Alert.alert(t.errorTitle || 'Chyba', error.message || 'Zoznam sa nepodarilo pridať.'); }
        finally { setListBusy(false); }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
            <View style={[styles.headerBlock, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
                <Pressable
                    accessibilityLabel={isSearching ? (t.close || 'Zavrieť') : (t.searchFood || 'Hľadať jedlo')}
                    style={({ pressed }) => [styles.headerIcon, { left: 16, backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                    onPress={() => isSearching ? closeSearch() : setIsSearching(true)}
                >
                    <Ionicons name={isSearching ? 'close' : 'search'} size={22} color={colors.text} />
                </Pressable>
                {isSearching ? (
                    <TextInput
                        ref={searchInputRef}
                        selectTextOnFocus
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={t.searchFood || 'Hľadať jedlo'}
                        placeholderTextColor={colors.muted}
                        style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                ) : (
                    <Pressable onPress={() => setListManagerOpen(true)} style={styles.listTitleButton}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.headerTitle, { color: colors.text }]}>{activeList?.name || t.favoritesTitle || 'Obľúbené'}</Text>
                        <Ionicons name="chevron-down" size={17} color={colors.muted} style={{ flexShrink: 0 }} />
                    </Pressable>
                )}
                <Pressable
                    style={({ pressed }) => [styles.headerIcon, { right: 16, backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                    onPress={() => setAddOpen(true)}
                >
                    <Ionicons name="add" size={24} color={colors.text} />
                </Pressable>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => {
                    if (!section.title) return null; // uncategorized — no header
                    const isExpanded = expandedCategories[section.categoryId] !== false; // default expanded
                    return (
                        <Pressable
                            onPress={() => toggleCategory(section.categoryId)}
                            style={[styles.categoryHeader, { borderBottomColor: colors.border }]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons
                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={colors.accent}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.categoryTitle, { color: colors.accent }]}>
                                    {section.title}
                                </Text>
                                <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 6 }}>({section.data.length})</Text>
                            </View>
                        </Pressable>
                    );
                }}
                renderItem={({ item, section }) => {
                    // Hide items if category is collapsed
                    if (section.title && expandedCategories[section.categoryId] === false) return null;
                    return (
                        <View style={{ marginBottom: 8 }}>
                        <FavoriteMealItem
                            item={item}
                            colors={colors}
                            t={t}
                            showImage={showImagesInHistory}
                            onAddToLog={() => handleAddToLog(item)}
                            onAddToLogLongPress={() => {
                                Keyboard.dismiss();
                                setWeightItem(item);
                                setWeightDialogOpen(true);
                            }}
                            onEdit={() => {
                                setEditItem(item);
                                setEditOpen(true);
                            }}
                            onDelete={() => handleDelete(item)}
                            onImagePress={() => setSelectedImage(item.imageUri)}
                        />
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={[styles.muted, { color: colors.muted }]}>{isSearching ? (t.noSearchResults || 'Nenašli sa žiadne jedlá.') : (t.emptyFavorites || 'Zatiaľ žiadne obľúbené jedlá.')}</Text>
                    </View>
                }
            />

            {/* Edit Favorite Dialog */}
            <MealEditDialog
                visible={editOpen}
                initialMeal={editItem}
                colors={colors}
                categories={foodCategories}
                imageStorageFolder="favorite_images"
                onCancel={() => {
                    setEditOpen(false);
                    setEditItem(null);
                }}
                onSave={async (patch) => {
                    try {
                        await updateFavorite(editItem.id, patch);
                        setEditOpen(false);
                        setEditItem(null);
                    } catch (e) {
                        Alert.alert(t.errorTitle, e.message || t.errorTitle);
                    }
                }}
            />

            {/* Add Favorite Dialog */}
            <MealEditDialog
                visible={addOpen}
                initialMeal={{}}
                mode="add"
                colors={colors}
                categories={foodCategories}
                imageStorageFolder="favorite_images"
                onCancel={() => setAddOpen(false)}
                onSave={async (mealData) => {
                    try {
                        await addFavorite(mealData, activeList?.id || 'default');
                        setAddOpen(false);
                    } catch (e) {
                        Alert.alert(t.errorTitle, e.message || t.errorTitle);
                    }
                }}
            />

            {/* Weight Dialog for long-press add */}
            <WeightDialog
                visible={weightDialogOpen}
                colors={colors}
                onCancel={() => {
                    setWeightDialogOpen(false);
                    setWeightItem(null);
                }}
                onConfirm={(grams) => {
                    setWeightDialogOpen(false);
                    if (weightItem && grams && grams > 0) {
                        handleAddToLogWithWeight(weightItem, grams);
                    }
                    setWeightItem(null);
                }}
            />

            <Modal visible={listManagerOpen} transparent animationType="fade" onRequestClose={closeListManager}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <Pressable style={styles.modalBackdrop} onPress={closeListManager}>
                    <Pressable style={[styles.listModal, { backgroundColor: colors.card === 'rgba(255,255,255,0.06)' ? '#161B22' : colors.card, borderColor: colors.border }]} onPress={() => {}}>
                        <View style={styles.listModalHeading}>
                            <Text style={[styles.listModalTitle, { color: colors.text }]}>Zoznamy obľúbených</Text>
                            <Pressable onPress={closeListManager}><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                        {favoriteLists.map(list => (
                            <View key={list.id} style={[styles.listRow, { borderColor: colors.border }]}>
                                {renamingList?.id === list.id ? <>
                                    <TextInput
                                        autoFocus
                                        accessibilityLabel={t.favoriteListName}
                                        value={renamingList.name}
                                        onChangeText={name => setRenamingList(current => ({ ...current, name }))}
                                        maxLength={60}
                                        editable={!listBusy}
                                        returnKeyType="done"
                                        onSubmitEditing={handleRenameList}
                                        style={[styles.newListInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                                    />
                                    <Pressable accessibilityLabel={t.save} disabled={listBusy || !renamingList.name.trim()} onPress={handleRenameList} style={styles.listAction}>
                                        <Ionicons name="checkmark" size={22} color={renamingList.name.trim() ? colors.accent : colors.muted} />
                                    </Pressable>
                                    <Pressable accessibilityLabel={t.cancel} disabled={listBusy} onPress={() => { setRenamingList(null); Keyboard.dismiss(); }} style={styles.listAction}>
                                        <Ionicons name="close" size={22} color={colors.muted} />
                                    </Pressable>
                                </> : <>
                                <Pressable style={styles.listSelect} onPress={() => selectList(list.id)}>
                                    <Ionicons name={list.id === activeList?.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.accent} />
                                    <Text style={[styles.listRowName, { color: colors.text }]}>{list.name}</Text>
                                </Pressable>
                                {list.id !== 'default' && <Pressable
                                    accessibilityLabel={`${t.renameFavoriteList}: ${list.name}`}
                                    disabled={listBusy}
                                    onPress={() => setRenamingList({ id: list.id, name: list.name })}
                                    style={styles.listAction}
                                ><Ionicons name="pencil-outline" size={19} color={colors.accent} /></Pressable>}
                                {list.id === 'default'
                                    ? favorites.some(item => item.listId === list.id) && <Pressable onPress={() => {
                                        const itemCount = favorites.filter(item => item.listId === list.id).length;
                                        Alert.alert('Vymazať všetky položky?', `Zo zoznamu „${list.name}“ sa natrvalo odstráni ${itemCount} položiek.`, [
                                            { text: t.cancel || 'Zrušiť', style: 'cancel' },
                                            { text: t.delete || 'Vymazať', style: 'destructive', onPress: () => clearFavoriteList(list.id) },
                                        ]);
                                    }}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
                                    : <Pressable onPress={() => Alert.alert('Vymazať zoznam?', `Zoznam „${list.name}“ a všetky jeho položky sa natrvalo odstránia.`, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: async () => { await deleteFavoriteList(list.id); if (list.id === activeListId) selectList('default'); } }])}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>}
                                </>}
                            </View>
                        ))}
                        </ScrollView>
                        <View style={styles.newListRow}>
                            <TextInput value={newListName} onChangeText={setNewListName} placeholder="Názov nového zoznamu" placeholderTextColor={colors.muted} style={[styles.newListInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
                            <Pressable onPress={handleCreateList} style={[styles.newListButton, { backgroundColor: colors.accent }]}><Ionicons name="add" size={22} color={colors.bg} /></Pressable>
                        </View>
                        <View style={styles.transferActions}>
                            <Pressable disabled={listBusy} onPress={handleImportList} style={[styles.transferButton, { borderColor: colors.border }]}><Ionicons name="download-outline" size={17} color={colors.accent} /><Text style={{ color: colors.text, fontWeight: '700' }}>Importovať</Text></Pressable>
                            <Pressable disabled={listBusy || !activeList} onPress={handleExportList} style={[styles.transferButton, { borderColor: colors.border }]}><Ionicons name="share-outline" size={17} color={colors.accent} /><Text style={{ color: colors.text, fontWeight: '700' }}>Exportovať</Text></Pressable>
                        </View>
                        <Pressable disabled={listBusy} onPress={handleInstallStarterList} style={[styles.starterButton, { borderColor: colors.accent }]}>
                            <Ionicons name="nutrition-outline" size={18} color={colors.accent} />
                            <Text style={{ color: colors.text, fontWeight: '700' }}>Pridať USDA základný zoznam (1 000)</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* Full Screen Image Zoom Viewer */}
            <ImageView
                images={[{ uri: selectedImage }]}
                imageIndex={0}
                visible={!!selectedImage}
                onRequestClose={() => setSelectedImage(null)}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                backgroundColor={colors.bg}
                HeaderComponent={({ imageIndex }) => (
                    <SafeAreaView edges={['top']} style={{ alignItems: 'flex-end', padding: 16 }}>
                        <Pressable
                            onPress={() => setSelectedImage(null)}
                            style={({ pressed }) => ({
                                padding: 8,
                                backgroundColor: colors.card,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1
                            })}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </SafeAreaView>
                )}
            />
        </SafeAreaView>
    );
}

const FavoriteMealItem = ({ item, colors, t, onAddToLog, onAddToLogLongPress, onEdit, onDelete, onImagePress, showImage }) => (
    <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.editMealTitle || 'Upraviť jedlo'}
        onPress={onEdit}
        style={({ pressed }) => [styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.itemCardPressed]}
    >
        {showImage && item.imageUri && (
            <Pressable onPress={onImagePress} style={{ marginRight: 2 }}>
                <Image
                    source={{ uri: item.imageUri }}
                    style={{ width: 56, height: 56, borderRadius: 2, backgroundColor: colors.border }}
                />
            </Pressable>
        )}
        <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.itemName, { color: colors.text }]}>{item.name || t.unknownFood}</Text>
            <View style={styles.itemValuesContainer}>
                <Text style={[styles.itemKcal, { color: colors.calories }]}>{Math.round(Number(item.calories || 0))} kcal</Text>
                <Text style={[styles.itemMacrosText, { color: colors.muted }]}>
                    {t.macroShortP}: {Math.round(Number(item.protein || 0))}g • {t.macroShortC}: {Math.round(Number(item.carbs || 0))}g • {t.macroShortF}: {Math.round(Number(item.fat || 0))}g
                    {item.weight_g ? ` • ${item.weight_g}g` : ''}
                </Text>
            </View>
        </View>

        <View style={styles.itemActions}>
            <Pressable
                style={({ pressed }) => [styles.miniAction, styles.addToLogAction, pressed && styles.actionBtnPressed]}
                onPress={onAddToLog}
                onLongPress={onAddToLogLongPress}
            >
                <Ionicons name="add" size={16} color={colors.accent} />
            </Pressable>
            <Pressable
                style={({ pressed }) => [styles.miniAction, styles.deleteAction, pressed && styles.actionBtnPressed]}
                onPress={onDelete}
            >
                <Ionicons name="trash-outline" size={16} color="rgba(239, 68, 68, 0.7)" />
            </Pressable>
        </View>
    </Pressable>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 60,
    },
    muted: {
        fontSize: 14,
    },
    headerBlock: {
        height: 68,
        paddingHorizontal: 16,
        paddingVertical: 0,
        alignItems: 'center',
    },
    headerTitle: { ...typography.screenTitle,
        flexShrink: 1,
        minWidth: 0,
        textAlign: 'center',
    },
    listTitleButton: {
        position: 'absolute',
        left: 62,
        right: 62,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    headerIcon: {
        position: 'absolute',
        top: 16,
        padding: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    searchInput: {
        position: 'absolute',
        left: 58,
        right: 58,
        top: 13,
        height: 42,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    itemCard: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    itemCardPressed: {
        opacity: 0.82,
    },
    itemName: { ...typography.itemTitle,
        },
    itemValuesContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
    },
    itemKcal: {
        fontWeight: '800',
        fontSize: 15,
    },
    itemMacrosText: {
        fontSize: 12,
        fontWeight: '500',
    },
    itemActions: {
        flexDirection: 'column',
        gap: 8,
    },
    miniAction: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    deleteAction: {
        borderColor: 'rgba(239, 68, 68, 0.2)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    addToLogAction: {
        borderColor: 'rgba(45, 212, 191, 0.3)',
        backgroundColor: 'rgba(45, 212, 191, 0.08)',
    },
    actionBtnPressed: {
        transform: [{ scale: 0.95 }],
        opacity: 0.7,
    },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 20 },
    listModal: { borderWidth: 1, borderRadius: 18, padding: 16, maxHeight: '80%' },
    listModalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    listModalTitle: { fontSize: 18, fontWeight: '800' },
    listRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, minHeight: 49, paddingVertical: 8, gap: 10 },
    listAction: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    listSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    listRowName: { fontWeight: '700', fontSize: 16, flex: 1 },
    newListRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    newListInput: { flex: 1, minHeight: 43, paddingHorizontal: 12, borderWidth: 1, borderRadius: 11, fontWeight: '600' },
    newListButton: { width: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    transferActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    transferButton: { flex: 1, borderWidth: 1, borderRadius: 11, minHeight: 42, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    starterButton: { marginTop: 8, minHeight: 42, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    categoryHeader: {
        paddingVertical: 12,
        paddingHorizontal: 2,
        marginTop: 8,
        marginBottom: 4,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
});
