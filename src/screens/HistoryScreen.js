import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageView from "react-native-image-viewing";
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { deleteMeal, updateMeal, subscribeToMeals, createMeal } from '../api/mealService';
import MealEditDialog from '../components/MealEditDialog';
import { useSettings } from '../state/SettingsContext';

import { useTranslation } from '../hooks/useTranslation';

const MEAL_CATEGORIES = [
  { id: 'breakfast', labelKey: 'catBreakfast', start: 1, end: 10 },
  { id: 'snack1', labelKey: 'catSnack1', start: 10, end: 11 },
  { id: 'lunch', labelKey: 'catLunch', start: 11, end: 14 },
  { id: 'snack2', labelKey: 'catSnack2', start: 14, end: 16 },
  { id: 'dinner', labelKey: 'catDinner', start: 16, end: 22 },
  { id: 'snack3', labelKey: 'catSnack3', start: 22, end: 1 },
];

function getMealCategoryId(date) {
  const hour = date.getHours();
  // Handle late snack crossing midnight (22:00 - 01:00)
  if (hour >= 22 || hour < 1) return 'snack3';

  const cat = MEAL_CATEGORIES.find(c => hour >= c.start && hour < c.end);
  return cat ? cat.id : 'other';
}

function getMealCategoryLabel(categoryId, t) {
  const cat = MEAL_CATEGORIES.find(c => c.id === categoryId);
  return cat ? t[cat.labelKey] : t.catOther;
}

function dateToKey(dateObj) {
  const yyyy = String(dateObj.getFullYear());
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateKeyToDate(dateKey) {
  const [yyyy, mm, dd] = String(dateKey).split('-').map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1, 12, 0, 0);
}

function formatDateLabelShort(dateObj, t, language, now) {
  const dateStr = dateObj.toLocaleDateString(language, { weekday: 'short', day: '2-digit', month: '2-digit' });

  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);

  if (dateToKey(dateObj) === dateToKey(today)) return `${t.today}, ${dateStr}`;
  if (dateToKey(dateObj) === dateToKey(yesterday)) return `${t.yesterday}, ${dateStr}`;

  return dateStr;
}

function formatDateLabelLong(dateObj, t, language, now) {
  const dateStr = dateObj.toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);

  if (dateToKey(dateObj) === dateToKey(today)) return `${t.today}, ${dateStr}`;
  if (dateToKey(dateObj) === dateToKey(yesterday)) return `${t.yesterday}, ${dateStr}`;

  return dateStr;
}

export default function HistoryScreen() {
  const t = useTranslation();
  const { theme, useLocalStorage, language, dailyGoal, showImagesInHistory } = useSettings();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef(null);
  const [now, setNow] = useState(new Date());

  // Nested expansion state: 
  // expandedDays: { [dateKey]: boolean }
  // expandedCategories: { [dateKey_categoryLabel]: boolean }
  const [expandedDays, setExpandedDays] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editMeal, setEditMeal] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const colors = theme === 'light'
    ? { bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', accent: '#0D9488', border: 'rgba(0,0,0,0.06)' }
    : { bg: '#0B0F14', card: 'rgba(255,255,255,0.06)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', accent: '#2DD4BF', border: 'rgba(255,255,255,0.1)' };

  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  // Midnight refresh check
  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      if (current.getDate() !== now.getDate()) {
        setNow(current);
      }
    }, 60000); // Check every minute

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const current = new Date();
        if (current.getDate() !== now.getDate()) {
          setNow(current);
        }
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [now]);

  useEffect(() => {
    // In local mode, we always subscribe immediately
    const unsub = subscribeToMeals(useLocalStorage, (fetched) => {
      // Ensure dateObj is present
      const sanitized = fetched.map(m => ({
        ...m,
        dateObj: m.dateObj || new Date(m.timestamp)
      }));
      setMeals(sanitized);
      setLoading(false);
    });

    return () => unsub();
  }, [useLocalStorage]);

  // Always expand today and the most recent meal type when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (scrollRef.current && sections?.length > 0) {
        try {
          scrollRef.current.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            viewOffset: 10,
            animated: false
          });
        } catch (e) {
          // Fallback if section 0 is not yet rendered or empty
          console.log('Scroll error:', e);
        }
      }

      if (meals.length > 0) {
        const todayKey = dateToKey(new Date());
        const hasToday = meals.some(m => dateToKey(m.dateObj) === todayKey);

        if (hasToday) {
          // Keep other days expanded if they were? No user said "others collapsed"
          setExpandedDays({ [todayKey]: true });

          const todayMeals = meals
            .filter(m => dateToKey(m.dateObj) === todayKey)
            .sort((a, b) => b.dateObj - a.dateObj);

          if (todayMeals.length > 0) {
            const lastCatId = getMealCategoryId(todayMeals[0].dateObj);
            setExpandedCategories({ [`${todayKey}_${lastCatId}`]: true });
          }
        } else {
          // If no today, maybe expand the first available day?
          // User didn't specify. Left as is (expand nothing or keep state).
          // Actually user said explicitly "aktualny den... ostatne vsetko zbalene".
          // If no current day data, maybe expanding nothing is fine.
        }
      }
    }, [meals])
  );

  const sections = useMemo(() => {
    const groups = new Map();

    for (const meal of meals) {
      const key = dateToKey(meal.dateObj);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(meal);
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));

    return sortedKeys.map((dateKey) => {
      const items = groups.get(dateKey) || [];

      const totals = items.reduce(
        (acc, m) => {
          acc.calories += Number(m.calories) || 0;
          acc.protein += Number(m.protein) || 0;
          acc.carbs += Number(m.carbs) || 0;
          acc.fat += Number(m.fat) || 0;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      return {
        dateKey,
        title: isMobile ? formatDateLabelShort(dateKeyToDate(dateKey), t, language, now) : formatDateLabelLong(dateKeyToDate(dateKey), t, language, now),
        totals,
        data: items, // SectionList's actual data is the full list of meals for that day
        allItems: items,
      };
    });
  }, [meals, isMobile, t, language, now]);

  const toggleDay = (dateKey) => {
    setExpandedDays((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const toggleCategory = (dateKey, categoryId) => {
    const key = `${dateKey}_${categoryId}`;
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.muted, { color: colors.muted }]}>{t.loading}</Text>
      </View>
    );
  }

  return (

    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['right', 'left', 'top']}>
      <View style={[styles.headerBlock, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.historyTitle}</Text>
        <Pressable
          style={({ pressed }) => [
            { position: 'absolute', right: 16, top: 17, padding: 8, borderRadius: 20, backgroundColor: colors.elemBg || 'rgba(255,255,255,0.1)' },
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => setAddOpen(true)}
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
      </View>

      <SectionList
        ref={scrollRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 1, paddingBottom: 100 }}
        indicatorStyle={theme === 'light' ? 'black' : 'white'}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          const isDayExpanded = expandedDays[section.dateKey] === true;
          const totals = section.totals;

          return (
            <View style={styles.sectionContainer}>
              <Pressable
                onPress={() => toggleDay(section.dateKey)}
                style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
              >
                <View style={styles.sectionLeftGroup}>
                  <Ionicons
                    name={isDayExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.accent}
                    style={{ marginRight: 8 }}
                  />
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{section.title}</Text>

                    {/* Progress Bar (Width 100px = 100% of Daily Goal) */}
                    <View style={{
                      height: 7,
                      width: 100, // This fixed width represents the Daily Goal
                      backgroundColor: 'rgba(59, 130, 246, 0.3)', // Blue: The Goal Track
                      marginTop: 6,
                      borderRadius: 3.5,
                      overflow: 'visible',
                      position: 'relative',
                    }}>
                      {/* Orange Calorie Fill (Can exceed 100%) */}
                      <View style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        backgroundColor: '#FB923C',
                        borderRadius: 3.5,
                        width: `${Math.min((totals.calories / (dailyGoal || 1)) * 100, 150)}%`
                      }} />

                      {/* Blue Goal Limit Marker (Visible when exceeded) */}
                      <View style={{
                        position: 'absolute',
                        left: '100%', // At exactly 100% of goal
                        top: 0,
                        bottom: 0,
                        width: 2,
                        backgroundColor: '#3B82F6', // Solid Blue
                        marginLeft: -1, // Center on the line
                        zIndex: 10, // Ensure it sits ON TOP of the orange bar
                      }} />
                    </View>
                  </View>
                </View>

                <View style={[styles.sectionRightGroup, { minWidth: 80 }]}>
                  <Text style={[styles.sectionKcal, { color: '#FB923C' }]}>{Math.round(totals.calories).toLocaleString()} kcal</Text>
                  <Text style={[styles.sectionMacros, { color: colors.muted }]}>{`${t.macroShortP}: ${Math.round(totals.protein)}g ${t.macroShortC}: ${Math.round(totals.carbs)}g ${t.macroShortF}: ${Math.round(totals.fat)}g`}</Text>
                </View>
              </Pressable>

              {isDayExpanded && (
                <View style={{ marginTop: 5 }}>
                  {[...MEAL_CATEGORIES].reverse().map(cat => {
                    const catId = cat.id;
                    const catLabel = t[cat.labelKey]; // Just label for display

                    // Filter using ID logic
                    const catMeals = section.allItems.filter(m => getMealCategoryId(m.dateObj) === catId);

                    if (catMeals.length === 0) return null;

                    const isCatExpanded = expandedCategories[`${section.dateKey}_${catId}`] === true;
                    const catCals = catMeals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);

                    return (
                      <View key={cat.id} style={styles.categoryBlock}>
                        <Pressable
                          onPress={() => toggleCategory(section.dateKey, catId)}
                          style={styles.categoryHeader}
                        >
                          <View style={styles.categoryLeftGroup}>
                            <Ionicons
                              name={isCatExpanded ? 'chevron-up' : 'chevron-down'}
                              size={14}
                              color={colors.muted}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.categoryLabel, { color: colors.muted }]}>
                              {catLabel} <Text style={{ fontSize: 13, fontWeight: '400', opacity: 0.7 }}>({catMeals.length})</Text>
                            </Text>
                          </View>

                          <Text style={{ fontWeight: '800', fontSize: 14, color: '#FB923C' }}>{Math.round(catCals).toLocaleString()} KCAL</Text>
                        </Pressable>

                        {isCatExpanded && (
                          <View style={{ gap: 8, marginTop: 4 }}>
                            {catMeals
                              .sort((a, b) => (a.dateObj > b.dateObj ? -1 : 1))
                              .map(item => (
                                <MealItem
                                  key={item.id}
                                  item={item}
                                  t={t}
                                  colors={colors}
                                  onEdit={() => {
                                    setEditMeal(item);
                                    setEditOpen(true);
                                  }}
                                  onDelete={async () => {
                                    Alert.alert(t.deleteMealTitle, t.deleteMealMsg, [
                                      { text: t.cancel, style: 'cancel' },
                                      {
                                        text: t.delete,
                                        style: 'destructive',
                                        onPress: async () => {
                                          try {
                                            await deleteMeal(item.id, useLocalStorage);
                                          } catch (e) {
                                            const friendly = { title: t.errorTitle, message: e.message || t.errorTitle };
                                            Alert.alert(friendly.title, friendly.message);
                                          }
                                        },
                                      },
                                    ]);
                                  }}
                                  onImagePress={() => setSelectedImage(item.imageUri)}
                                  showImage={showImagesInHistory}
                                />
                              ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        }}
        renderItem={() => null}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.muted, { color: colors.muted }]}>{t.emptyHistory}</Text>
          </View>
        }
      />

      <MealEditDialog
        visible={editOpen}
        initialMeal={editMeal}
        colors={colors}
        onCancel={() => {
          setEditOpen(false);
          setEditMeal(null);
        }}
        onSave={async (patch) => {
          try {
            // Delete old image if removed
            if (editMeal?.imageUri && patch.imageUri === null) {
              try {
                await FileSystem.deleteAsync(editMeal.imageUri, { idempotent: true });
              } catch (err) {
                console.warn('Failed to delete old image', err);
              }
            }

            await updateMeal(editMeal.id, {
              ...patch,
              confidence: Number(editMeal?.confidence ?? 0.5),
            }, useLocalStorage);
            setEditOpen(false);
            setEditMeal(null);
          } catch (e) {
            const friendly = { title: t.errorTitle, message: e.message || t.errorTitle };
            Alert.alert(friendly.title, friendly.message);
          }
        }}
      />

      {/* Add Meal Dialog */}
      <MealEditDialog
        visible={addOpen}
        initialMeal={{}} // Empty for add
        mode="add"
        colors={colors}
        onCancel={() => setAddOpen(false)}
        onSave={async (mealData) => {
          try {
            await createMeal({
              ...mealData,
              confidence: 1.0, // Manual entry is 100% confident
            }, useLocalStorage);
            setAddOpen(false);
          } catch (e) {
            const friendly = { title: t.errorTitle, message: e.message || t.errorTitle };
            Alert.alert(friendly.title, friendly.message);
          }
        }}
      />

      {/* Full Screen Image Modal */}
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

const MealItem = ({ item, colors, t, onEdit, onDelete, onImagePress, showImage }) => (
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
  },
  muted: {
    fontSize: 14,
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 6, // Reduced from 20
  },
  sectionHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start', // Align top so macros wrap nicely below
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sectionRightGroup: {
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 16,
  },
  categoryBlock: {
    marginVertical: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  categoryLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionMacros: {
    fontSize: 11, // Smaller macros
    fontWeight: '500',
    marginTop: 2,
  },
  sectionKcal: {
    fontWeight: '900',
    fontSize: 18,
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
  actionBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.7,
  },
  actionBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.7,
  },
});
