export function usesNativeTabRail(platform, isIOSAppOnMac = false) {
  return platform.OS === 'ios' && !isIOSAppOnMac
    && !platform.isMacCatalyst && platform.constants?.interfaceIdiom !== 'mac';
}
