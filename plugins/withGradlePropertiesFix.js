const { withGradleProperties } = require('expo/config-plugins');

const withGradlePropertiesFix = (config) => {
    return withGradleProperties(config, (config) => {
        // 1. Remove ANY existing entries for expo.useLegacyPackaging to avoid conflicts
        // Also remove the deprecated android.bundle.enableUncompressedNativeLibs if present (just to be clean)
        config.modResults = config.modResults.filter(
            item => item.key !== 'expo.useLegacyPackaging' && item.key !== 'android.bundle.enableUncompressedNativeLibs'
        );

        // 2. Add the correct values
        config.modResults.push({
            type: 'property',
            key: 'expo.useLegacyPackaging',
            value: 'true',
        });

        // NOTE: android.bundle.enableUncompressedNativeLibs is deprecated/removed in newer AGP, so we do NOT set it.

        return config;
    });
};

module.exports = withGradlePropertiesFix;
