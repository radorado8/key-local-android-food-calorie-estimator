const { withGradleProperties } = require('expo/config-plugins');

const withGradlePropertiesFix = (config) => {
    return withGradleProperties(config, (config) => {
        // Force expo.useLegacyPackaging to true
        const legacyPackaging = config.modResults.find(item => item.key === 'expo.useLegacyPackaging');
        if (legacyPackaging) {
            legacyPackaging.value = 'true';
        } else {
            config.modResults.push({
                type: 'property',
                key: 'expo.useLegacyPackaging',
                value: 'true',
            });
        }

        // Force android.bundle.enableUncompressedNativeLibs to false (to force compression -> extraction)
        const uncompressedLibs = config.modResults.find(item => item.key === 'android.bundle.enableUncompressedNativeLibs');
        if (uncompressedLibs) {
            uncompressedLibs.value = 'false';
        } else {
            config.modResults.push({
                type: 'property',
                key: 'android.bundle.enableUncompressedNativeLibs',
                value: 'false',
            });
        }

        return config;
    });
};

module.exports = withGradlePropertiesFix;
