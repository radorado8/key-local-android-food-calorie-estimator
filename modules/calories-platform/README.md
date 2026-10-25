# CaloriesPlatform

Small local Expo module exposing `ProcessInfo.isiOSAppOnMac` (and Mac Catalyst) as the `isIOSAppOnMac` constant. A window's size or the iPad interface idiom cannot distinguish a physical iPad from an iPad app running on an Apple Silicon Mac.

`AdaptiveTabNavigator` uses this flag to render its bottom navigation on Mac while keeping system-native tabs on iPhone, iPad and Duo. Android/web do not import this native module. Rebuild the iOS app after changing the module; a JavaScript refresh alone cannot add native modules. The JavaScript import is optional so older binaries remain usable.

Apple API: https://developer.apple.com/documentation/foundation/processinfo/isiosapponmac
