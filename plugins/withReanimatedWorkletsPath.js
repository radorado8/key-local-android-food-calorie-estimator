const { withProjectBuildGradle } = require('expo/config-plugins');

// Reanimated 4.1 links Worklets from the legacy `intermediates/cmake` folder,
// while current Android Gradle Plugin writes the libraries under `intermediates/cxx`.
// Populate the legacy location after Worklets builds and before Reanimated links.
const withReanimatedWorkletsPath = (config) => withProjectBuildGradle(config, (config) => {
  const marker = 'apply plugin: "expo-root-project"';
  const block = `gradle.projectsEvaluated {
  def workletsProject = rootProject.findProject(':react-native-worklets')
  def reanimatedProject = rootProject.findProject(':react-native-reanimated')
  if (workletsProject != null && reanimatedProject != null) {
    def prepareWorkletsForReanimated = rootProject.tasks.register('prepareWorkletsForReanimated') {
      dependsOn workletsProject.tasks.named('externalNativeBuildRelease')
      doLast {
        copy {
          from workletsProject.fileTree("\${workletsProject.buildDir}/intermediates/cxx/RelWithDebInfo") {
            include '**/obj/**/libworklets.so'
          }
          into "\${workletsProject.buildDir}/intermediates/cmake/release/obj"
          eachFile { details ->
            def parts = details.relativePath.segments
            details.relativePath = new RelativePath(true, parts[parts.length - 2], 'libworklets.so')
          }
          includeEmptyDirs = false
        }
      }
    }
    reanimatedProject.tasks.configureEach { task ->
      if (task.name.startsWith('buildCMakeRelWithDebInfo')) {
        task.dependsOn prepareWorkletsForReanimated
      }
    }
    reanimatedProject.tasks.named('externalNativeBuildRelease').configure {
      dependsOn prepareWorkletsForReanimated
    }
  }
}

`;

  if (!config.modResults.contents.includes('prepareWorkletsForReanimated')) {
    config.modResults.contents = config.modResults.contents.replace(marker, `${block}${marker}`);
  }
  return config;
});

module.exports = withReanimatedWorkletsPath;
