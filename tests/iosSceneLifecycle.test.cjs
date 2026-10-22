const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const hooks = {};
const moduleObject = { exports: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../plugins/withIosSceneLifecycle.js'), 'utf8'), {
  module: moduleObject,
  require: () => ({
    withInfoPlist: (config, hook) => { hooks.plist = hook; return config; },
    withAppDelegate: (config, hook) => { hooks.delegate = hook; return config; },
  }),
});
moduleObject.exports({});
const source = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  func launch() {
    bindReactNativeFactory(factory)
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
#endif
  }
}`;
const apply = contents => hooks.delegate({ modResults: { language: 'swift', contents } }).modResults.contents;
test('React Native starts in a scene-connected window, without transferring a detached controller', () => {
  const result = apply(source);
  assert.ok(!result.includes('UIScreen.main.bounds'));
  assert.ok(!result.includes('window.rootViewController = appDelegate.window'));
  assert.equal((result.match(/startReactNative\(/g) || []).length, 1);
  assert.ok(result.indexOf('UIWindow(windowScene: windowScene)') < result.indexOf('startReactNative('));
  assert.ok(result.includes('reactNativeLaunchOptions = launchOptions'));
  assert.ok(result.includes('launchOptions: appDelegate.reactNativeLaunchOptions'));
});
test('regenerating iOS keeps a single scene delegate and a single launch', () => {
  const once = apply(source);
  assert.equal(apply(once), once);
});
