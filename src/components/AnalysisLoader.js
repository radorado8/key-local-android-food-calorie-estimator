import React from 'react';
import { StyleSheet, Text, View, Image, ActivityIndicator, Pressable, Dimensions } from 'react-native';
import { useSettings } from '../state/SettingsContext';

const { width } = Dimensions.get('window');

export default function AnalysisLoader({ imageUri, onCancel, t }) {
    const { theme } = useSettings();

    const colors = theme === 'light'
        ? { text: '#0F172A', muted: '#64748B', btnText: '#0F172A', btnBorder: '#CBD5E1', glass: 'rgba(255,255,255,0.7)' }
        : { text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', btnText: '#FFFFFF', btnBorder: 'rgba(255,255,255,0.3)', glass: 'rgba(0,0,0,0.5)' };

    return (
        <View style={styles.container}>
            {/* Scan Area */}
            <View style={[styles.scanArea, { borderColor: colors.btnBorder }]}>
                {imageUri && (
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.previewImage}
                        blurRadius={10}
                    />
                )}
                <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <ActivityIndicator size="large" color="#2DD4BF" style={{ transform: [{ scale: 1.5 }] }} />
                </View>
            </View>

            {/* Loading Text */}
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: '#2DD4BF' }]}>{t.analyzing}</Text>
                <Text style={[styles.desc, { color: colors.muted }]}>{t.analyzingSubtitle || t.analyzingDesc}</Text>
            </View>

            {/* Cancel Button */}
            <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                    styles.btn,
                    { borderColor: colors.btnBorder, backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent' }
                ]}
            >
                <Text style={[styles.btnText, { color: colors.btnText }]}>{t.cancel}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        gap: 24,
        paddingVertical: 20,
    },
    scanArea: {
        width: width - 64, // roughly screen width - padding
        height: width - 64,
        maxWidth: 300,
        maxHeight: 300,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        opacity: 0.8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
    },
    desc: {
        fontSize: 16,
        textAlign: 'center',
    },
    btn: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 50,
        borderWidth: 1,
    },
    btnText: {
        fontWeight: '700',
        fontSize: 16,
    }
});
