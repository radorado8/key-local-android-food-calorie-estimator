const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const withIosSceneLifecycle = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('The iOS scene lifecycle plugin requires a Swift AppDelegate.');
    }

    const sceneDelegate = `
@available(iOS 13.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.reactNativeLaunchOptions
    )
  }
}
`;

    if (!config.modResults.contents.includes('var reactNativeLaunchOptions:')) {
      config.modResults.contents = config.modResults.contents.replace(
        '  var window: UIWindow?',
        '  var window: UIWindow?\n  var reactNativeLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?'
      );
      config.modResults.contents = config.modResults.contents.replace(
        '    bindReactNativeFactory(factory)',
        '    bindReactNativeFactory(factory)\n    reactNativeLaunchOptions = launchOptions'
      );
    }
    // Create React Native only after UIKit provides the scene's window.
    config.modResults.contents = config.modResults.contents.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif/,
      ''
    );
    config.modResults.contents = config.modResults.contents.replace(
      /\n@available\(iOS 13\.0, \*\)\nclass SceneDelegate:[\s\S]*$/,
      ''
    );
    if (!config.modResults.contents.includes('class SceneDelegate: UIResponder, UIWindowSceneDelegate')) {
      config.modResults.contents += sceneDelegate;
    }
    return config;
  });
};

module.exports = withIosSceneLifecycle;
