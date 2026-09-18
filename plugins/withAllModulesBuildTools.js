const { withProjectBuildGradle } = require('expo/config-plugins');

const withAllModulesBuildTools = (config) => withProjectBuildGradle(config, (config) => {
  const marker = 'apply plugin: "expo-root-project"';
  const block = `subprojects { subproject ->
  subproject.plugins.withId('com.android.application') {
    subproject.android.buildToolsVersion rootProject.ext.buildToolsVersion
  }
  subproject.plugins.withId('com.android.library') {
    subproject.android.buildToolsVersion rootProject.ext.buildToolsVersion
  }
}

`;

  if (!config.modResults.contents.includes(block)) {
    config.modResults.contents = config.modResults.contents.replace(marker, `${block}${marker}`);
  }
  return config;
});

module.exports = withAllModulesBuildTools;
