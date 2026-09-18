const { withPodfile } = require('expo/config-plugins');

const withIosPodsDeploymentTarget = (config) =>
  withPodfile(config, (config) => {
    const marker = '    # Keep CocoaPods targets compatible with the installed Xcode simulator SDK.\n';
    const block = `${marker}    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |build_configuration|\n        build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'\n      end\n    end\n`;
    const postInstallEnd = '    )\n  end\nend\n';

    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(
        postInstallEnd,
        `    )\n${block}  end\nend\n`
      );
    }
    return config;
  });

module.exports = withIosPodsDeploymentTarget;
