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
    window.rootViewController = appDelegate.window?.rootViewController
    self.window = window
    appDelegate.window = window
    window.makeKeyAndVisible()
  }
}
`;

    if (!config.modResults.contents.includes('class SceneDelegate: UIResponder, UIWindowSceneDelegate')) {
      config.modResults.contents += sceneDelegate;
    }
    return config;
  });
};

module.exports = withIosSceneLifecycle;
