const { withAndroidManifest } = require('expo/config-plugins');

const withExtractNativeLibs = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        if (androidManifest.manifest.application && androidManifest.manifest.application[0]) {
            androidManifest.manifest.application[0].$['android:extractNativeLibs'] = 'true';
        }
        return config;
    });
};

module.exports = withExtractNativeLibs;
