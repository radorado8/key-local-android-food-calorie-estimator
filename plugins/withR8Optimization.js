const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * Uses Android's optimized default R8 rules in production builds.
 * expo-build-properties enables minification and resource shrinking; this plugin
 * upgrades the generated default rules from compatibility-only to optimization rules.
 */
const withR8Optimization = (config) => {
  config = withGradleProperties(config, (config) => {
    const setProperty = (key, value) => {
      const existing = config.modResults.find((item) => item.key === key);
      if (existing) existing.value = value;
      else config.modResults.push({ type: 'property', key, value });
    };

    setProperty('org.gradle.jvmargs', '-Xmx4g -XX:MaxMetaspaceSize=1g');
    // Reanimated and Worklets occasionally race during parallel native builds.
    setProperty('org.gradle.workers.max', '1');
    setProperty('android.r8.optimizedResourceShrinking', 'true');
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );
    return config;
  });
};

module.exports = withR8Optimization;
