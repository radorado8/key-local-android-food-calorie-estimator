const { withAndroidManifest } = require('@expo/config-plugins');

const withGmsVersion = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        if (!androidManifest.manifest.application) {
            return config;
        }

        const application = androidManifest.manifest.application[0];
        const metaData = application['meta-data'] || [];

        // Check if the metadata already exists
        if (!metaData.some(m => m.$['android:name'] === 'com.google.android.gms.version')) {
            metaData.push({
                $: {
                    'android:name': 'com.google.android.gms.version',
                    'android:value': '@integer/google_play_services_version',
                },
            });
        }

        application['meta-data'] = metaData;
        return config;
    });
};

module.exports = withGmsVersion;
