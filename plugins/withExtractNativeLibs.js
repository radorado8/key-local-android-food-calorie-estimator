const { withAndroidManifest } = require('expo/config-plugins');

const withExtractNativeLibs = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Ensure 'tools' namespace is available
        if (!androidManifest.manifest.$['xmlns:tools']) {
            androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
        }

        if (androidManifest.manifest.application && androidManifest.manifest.application[0]) {
            const app = androidManifest.manifest.application[0];
            app.$['android:extractNativeLibs'] = 'true';

            // Add tools:replace to ensure we override any library that sets this to false
            if (app.$['tools:replace']) {
                const replacements = app.$['tools:replace'].split(',').map(s => s.trim());
                if (!replacements.includes('android:extractNativeLibs')) {
                    app.$['tools:replace'] = `${app.$['tools:replace']},android:extractNativeLibs`;
                }
            } else {
                app.$['tools:replace'] = 'android:extractNativeLibs';
            }
        }
        return config;
    });
};

module.exports = withExtractNativeLibs;
