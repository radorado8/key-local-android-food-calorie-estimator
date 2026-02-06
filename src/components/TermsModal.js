import React from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, BackHandler, Linking, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../state/SettingsContext';

export default function TermsModal({ visible, onClose, mode = 'onboarding' }) {
    const t = useTranslation();
    const { setTermsAccepted, theme } = useSettings();
    const insets = useSafeAreaInsets();
    const screenHeight = Dimensions.get('window').height;

    const isDark = theme !== 'light';
    const colors = isDark
        ? { bg: '#161B22', text: '#FFFFFF', muted: '#A1A1AA', card: '#0B0F14', border: '#30363D', accent: '#2DD4BF', link: '#58A6FF' }
        : { bg: '#FFFFFF', text: '#0F172A', muted: '#64748B', card: '#F8FAFC', border: '#E2E8F0', accent: '#0D9488', link: '#0969DA' };

    const handleAccept = () => {
        if (mode === 'onboarding') {
            setTermsAccepted(true);
        }
        if (onClose) onClose();
    };

    const handleDecline = () => {
        if (mode === 'onboarding') {
            BackHandler.exitApp();
        } else {
            if (onClose) onClose();
        }
    };

    const renderTextWithLinks = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);

        return parts.map((part, index) => {
            if (part.match(urlRegex)) {
                return (
                    <Text
                        key={index}
                        style={{ color: colors.link, textDecorationLine: 'underline' }}
                        onPress={() => Linking.openURL(part)}
                    >
                        {part}
                    </Text>
                );
            }
            return <Text key={index}>{part}</Text>;
        });
    };

    // Calculate max height safely (e.g. 70% of screen height)
    const maxHeight = screenHeight * 0.7;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (mode !== 'onboarding') onClose(); }}>
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.8)', paddingBottom: insets.bottom + 20 }]}>
                <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border, maxHeight: maxHeight }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{t.termsTitle}</Text>

                    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 0 }}>
                        <Text style={[styles.body, { color: colors.text }]}>{renderTextWithLinks(t.termsBody)}</Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        {mode === 'onboarding' ? (
                            <>
                                <Pressable onPress={handleDecline} style={[styles.btn, { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 }]}>
                                    <Text style={{ color: colors.muted, fontWeight: '600' }}>{t.termsDecline}</Text>
                                </Pressable>
                                <Pressable onPress={handleAccept} style={[styles.btn, { backgroundColor: colors.accent }]}>
                                    <Text style={{ color: isDark ? '#000' : '#fff', fontWeight: 'bold' }}>{t.termsAccept}</Text>
                                </Pressable>
                            </>
                        ) : (
                            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.card, width: '100%' }]}>
                                <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>{t.cancel || 'Close'}</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        // maxHeight set dynamically now
        borderRadius: 24,
        borderWidth: 1,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        display: 'flex',
        flexDirection: 'column',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 16,
        textAlign: 'center',
        flexShrink: 0,
    },
    scroll: {
        marginBottom: 20,
        flexShrink: 1,
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        flexShrink: 0,
        marginTop: 'auto',
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
