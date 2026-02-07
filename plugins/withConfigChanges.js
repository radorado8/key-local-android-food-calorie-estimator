const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config plugin to add configChanges to MainActivity.
 * This prevents activity recreation when navigation mode changes,
 * which fixes ImagePicker crashes while keeping launchMode: singleTask for shortcuts.
 */
const withConfigChanges = (config) => {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults;
        const mainApplication = manifest.manifest.application?.[0];

        if (!mainApplication?.activity) {
            console.warn('withConfigChanges: No activities found in manifest');
            return config;
        }

        // Find MainActivity
        const mainActivity = mainApplication.activity.find(
            (activity) => activity.$?.['android:name'] === '.MainActivity'
        );

        if (mainActivity) {
            // Add standard configChanges to handle configuration changes
            // that could cause activity recreation
            const configChanges = [
                'keyboard',
                'keyboardHidden',
                'orientation',
                'screenSize',
                'screenLayout',
                'uiMode',
                'navigation',
                'smallestScreenSize',
            ].join('|');

            mainActivity.$['android:configChanges'] = configChanges;

            console.log('withConfigChanges: Added configChanges to MainActivity');
        } else {
            console.warn('withConfigChanges: MainActivity not found');
        }

        return config;
    });
};

module.exports = withConfigChanges;
