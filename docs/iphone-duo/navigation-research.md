# Adaptive Apple navigation

## Runtime and requirements

The app uses Expo SDK 58, React Native 0.88, React 19.3 and react-native-screens 4.30. iOS requires 16.4 or newer. Android compiles with SDK 37 and targets API 36; its navigation stays on the existing React implementation.

## Navigation and layout

- iPhone, iPad and Duo use the system tab controller. iPadOS places its floating menu at the top; Duo places it in the system side rail.
- Wide landscape windows keep Home visible alongside the selected History, Favorites, Analytics or Settings screen. Home is omitted from the native menu while it is pinned.
- The Duo divider follows the physical midpoint of the application window. Home shares its half with the system rail, leaving the detail pane wider. Home follows the rail if it moves to the other side. Compact windows return to a single pane and Home reappears in the menu.
- Native tabs measure the safe content bounds; React panes remain mounted in one overlay so tab changes and fold transitions do not remount their state. Inactive SVG screens retain nonzero viewports. The existing SVG geometry patch remains necessary during transitions.
- The tab host, native screens and safe-area measurement surfaces use the selected palette background. This also colors the substrate beneath Liquid Glass; setting only tabBarBackgroundColor is ineffective on newer iOS versions.

## Mac

The local Expo module in modules/calories-platform exports ProcessInfo.isiOSAppOnMac, also handling Mac Catalyst. Neither window size nor the iPad interface idiom reliably distinguishes a physical iPad from an iPad app running on Mac. NativeTabPolicy selects React bottom navigation on Mac and native tabs on physical/simulated Apple mobile devices.

Expo Autolinking discovers the module from modules/. Adding or changing it requires CocoaPods installation and a native rebuild. The JavaScript import is optional, so older test binaries remain usable. Android and web use a separate JavaScript fallback without importing the Apple module.

For local Designed for iPad testing, Xcode builds an iOS executable. A directly opened raw iOS .app may report incorrect executable format. The tested local wrapper uses this layout, matching the installed Mac App Store app:

```text
Calories AI.app/
  Wrapper/CaloriesAILocal.app/
  WrappedBundle -> Wrapper/CaloriesAILocal.app
```

The App Store handles this packaging for distributed builds. Local testing did not replace the installed App Store copy.

## SDK migration details

- expo-audio replaces expo-av; recording retains the 30-second cap.
- Android dev builds explicitly pass BuildConfig.DEBUG to Expo's React host. Release builds include the JavaScript bundle and do not require Metro.
- The navigation bar uses the current declarative Expo API. Media-library saves use its legacy entry point where required.
- Camera controls are siblings of CameraView, not unsupported children. The modal uses a full-size flex container. Android controls are layered above the preview and use native shutter animation rather than a black overlay; iOS retains the custom noninteractive shutter animation.
- Native build plugins retain deployment-target and signing compatibility. Android release builds use R8 and resource shrinking, and the AAB includes its obfuscation mapping.

## Validation

- 181 Node tests passed, including platform selection, split geometry and navigation event handling.
- Native navigation smoke tests previously passed on iPhone 17e and Duo. Continuous physical hinge movement through every angle still needs manual verification; rotation tests do not cover the complete hinge transition.
- The iPad Pro 13-inch (M5) UI navigation and rotation test passed. History, Favorites, Analytics and Settings were additionally checked from exported screenshots because iPad floating tabs do not expose the AX selected trait. Portrait and settled two-pane landscape layouts were visually checked. A screenshot taken mid-rotation can contain a transient crop and is not evidence of the settled layout.
- On the local Mac app, the debugger confirmed isiOSAppOnMac = YES and bottom tab frames at y=806 with height=36 in a window of height 842. System screenshot/accessibility capture was unavailable due to OS permissions, so this is a runtime geometry check rather than a Mac screenshot check.
- Signed Android production build 1.0.74 (257), target API 36, launched without Metro. History, Favorites, Analytics, Settings, Home, camera open/cancel and gallery open/cancel passed on the emulator. Verify the installed version before testing; old emulator snapshots may restore a previous application build.
- No paid AI requests were used for these UI checks. Simulator camera tests do not establish physical iPhone capture quality or complete Health integration coverage.

The prebuilt Hermes framework currently lacks a matching dSYM in the exported iOS archive. Apple accepts the upload with a warning, but native Hermes crashes cannot be fully symbolicated with that missing symbol file.

## Primary references

- [Apple: iPhone Duo preparation](https://developer.apple.com/iphone-duo/prepare/)
- [Apple: iOS app running on Mac](https://developer.apple.com/documentation/foundation/processinfo/isiosapponmac)
- [Apple: multiplatform app destinations](https://developer.apple.com/documentation/xcode/configuring-a-multiplatform-app-target)
- [Apple: Liquid Glass color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- [Expo: local native modules](https://docs.expo.dev/modules/get-started/)
- [React Native Screens](https://github.com/software-mansion/react-native-screens)
