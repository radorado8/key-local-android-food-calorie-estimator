const { withAppBuildGradle } = require('expo/config-plugins');

const withHardcodedLegacyPackaging = (config) => {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const contents = config.modResults.contents;
            // Replace the dynamic check with hardcoded true
            const newContents = contents.replace(
                /useLegacyPackaging\s*\(findProperty\('expo\.useLegacyPackaging'\)\?\.toBoolean\(\)\s*\?:\s*false\)/g,
                'useLegacyPackaging true // Hardcoded by withHardcodedLegacyPackaging'
            );

            // Also catch if it was already modified or looks different (simple fallback)
            if (newContents === contents) {
                // If regex didn't match, maybe try to inject it or replace 'useLegacyPackaging false' if that's what it defaults to manually
                // But usually, the prebuild template is standard. 
                // Let's try to match a broader pattern just in case
                config.modResults.contents = contents.replace(
                    /useLegacyPackaging.*(\r\n|\r|\n)/,
                    'useLegacyPackaging true\n'
                );
            } else {
                config.modResults.contents = newContents;
            }
        }
        return config;
    });
};

module.exports = withHardcodedLegacyPackaging;
