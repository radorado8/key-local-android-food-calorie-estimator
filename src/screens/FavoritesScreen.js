import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageView from "react-native-image-viewing";
import { Ionicons } from '@expo/vector-icons';
import { subscribeFavorites, removeFavorite, updateFavorite, addFavorite } from '../api/favoritesService';
import { createMeal } from '../api/mealService';
import MealEditDialog from '../components/MealEditDialog';
import { useSettings } from '../state/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';

export default function FavoritesScreen() {
    const t = useTranslation();
    const { theme, showImagesInHistory, useLocalStorage } = useSettings();
    const [favorites, setFavorites] = useState([]);
    const [editOpen, setEditOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const colors = theme === 'light'
        ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)' }
        : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)' };

    useEffect(() => {
        const unsub = subscribeFavorites((fetched) => {
            setFavorites(fetched);
        });
        return () => unsub();
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
            <View style={[styles.headerBlock, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t.favoritesTitle || 'Obľúbené'}</Text>
                <Pressable
                    style={({ pressed }) => [
                        { position: 'absolute', right: 16, top: 13, padding: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                        pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => setAddOpen(true)}
                >
                    <Ionicons name="add" size={24} color={colors.text} />
                </Pressable>
            </View>

            <FlatList
                data={favorites}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 8 }}
                renderItem={({ item }) => (
                    <FavoriteMealItem
                        item={item}
                        colors={colors}
                        t={t}
                        showImage={showImagesInHistory}
                        onAddToLog={() => handleAddToLog(item)}
                        onEdit={() => {
                            setEditItem(item);
                            setEditOpen(true);
                        }}
                        onDelete={() => handleDelete(item)}
                        onImagePress={() => setSelectedImage(item.imageUri)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={[styles.muted, { color: colors.muted }]}>{t.emptyFavorites || 'Zatiaľ žiadne obľúbené jedlá.'}</Text>
                    </View>
                }
            />

            {/* Edit Favorite Dialog */}
            <MealEditDialog
                visible={editOpen}
                initialMeal={editItem}
                colors={colors}
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
                onCancel={() => setAddOpen(false)}
                onSave={async (mealData) => {
                    try {
                        await addFavorite({
                            ...mealData,
                        });
                        setAddOpen(false);
                    } catch (e) {
                        Alert.alert(t.errorTitle, e.message || t.errorTitle);
                    }
                }}
            />

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

const FavoriteMealItem = ({ item, colors, t, onAddToLog, onEdit, onDelete, onImagePress, showImage }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                <Text style={[styles.itemKcal, { color: '#FB923C' }]}>{Math.round(Number(item.calories || 0))} kcal</Text>
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
            >
                <Ionicons name="add" size={16} color={colors.accent} />
            </Pressable>
            <Pressable
                style={({ pressed }) => [styles.miniAction, pressed && styles.actionBtnPressed]}
                onPress={onEdit}
            >
                <Ionicons name="pencil" size={16} color={colors.muted} />
            </Pressable>
            <Pressable
                style={({ pressed }) => [styles.miniAction, styles.deleteAction, pressed && styles.actionBtnPressed]}
                onPress={onDelete}
            >
                <Ionicons name="trash-outline" size={16} color="rgba(239, 68, 68, 0.7)" />
            </Pressable>
        </View>
    </View>
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
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 8,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    },
    itemCard: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    itemName: {
        fontWeight: '700',
        fontSize: 17,
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
});
