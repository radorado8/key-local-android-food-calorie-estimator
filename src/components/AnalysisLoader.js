import { typography } from '../theme/palette';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Image, ActivityIndicator, Pressable, Dimensions } from 'react-native';
import { useSettings } from '../state/SettingsContext';

const { width } = Dimensions.get('window');

function AudioWaveform() {
    const bars = useRef(Array.from({ length: 13 }, () => new Animated.Value(0.28))).current;

    useEffect(() => {
        const animations = bars.map((bar, index) => Animated.loop(
            Animated.sequence([
                Animated.timing(bar, {
                    toValue: 0.48 + ((index * 19) % 45) / 100,
                    duration: 360 + (index % 4) * 95,
                    useNativeDriver: true,
                }),
                Animated.timing(bar, {
                    toValue: 0.2 + ((index * 11) % 18) / 100,
                    duration: 340 + (index % 3) * 110,
                    useNativeDriver: true,
                }),
            ])
        ));
        animations.forEach((animation) => animation.start());
        return () => animations.forEach((animation) => animation.stop());
    }, [bars]);

    return (
        <View style={styles.waveform} accessibilityLabel="Analyzing voice recording">
            {bars.map((bar, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.waveBar,
                        { transform: [{ scaleY: bar }] },
                    ]}
                />
            ))}
        </View>
    );
}

export default function AnalysisLoader({ imageUri, inputType, inputText, onCancel, t, isRetrying }) {
    const { theme } = useSettings();

    const { colors } = useSettings();

    return (
        <View style={styles.container}>
            {/* Scan Area */}
            <View style={[styles.scanArea, { borderColor: colors.btnBorder }]}>
                {imageUri ? (
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.previewImage}
                        blurRadius={10}
                    />
                ) : inputType === 'audio' ? (
                    <View style={styles.audioVisual}>
                        <AudioWaveform />
                    </View>
                ) : (
                    <View style={styles.textVisual}>
                        <Text numberOfLines={4} style={styles.blurredText}>
                            {inputText || '...'}
                        </Text>
                    </View>
                )}
                <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <ActivityIndicator size="large" color={colors.accent} style={{ transform: [{ scale: 1.5 }] }} />
                </View>
            </View>

            {/* Loading Text */}
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.accent }]}>{isRetrying ? t.analyzingRetrying : t.analyzing}</Text>
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
    textVisual: {
        width: '100%',
        height: '100%',
        padding: 30,
        justifyContent: 'center',
        backgroundColor: '#0F766E',
    },
    blurredText: {
        color: '#FFFFFF',
        fontSize: 29,
        fontWeight: '800',
        lineHeight: 40,
        opacity: 0.48,
        textShadowColor: 'rgba(255,255,255,0.9)',
        textShadowRadius: 12,
        textShadowOffset: { width: 1, height: 2 },
    },
    audioVisual: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#064E4B',
    },
    waveform: {
        height: 130,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
    },
    waveBar: {
        width: 10,
        height: 116,
        borderRadius: 8,
        backgroundColor: '#5EEAD4',
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
    title: { ...typography.sectionTitle,
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
