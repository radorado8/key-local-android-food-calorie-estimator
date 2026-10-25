import { requireOptionalNativeModule } from 'expo';

// ProcessInfo distinguishes Designed for iPad on Mac from a physical iPad.
export const isIOSAppOnMac = requireOptionalNativeModule('CaloriesPlatform')?.isIOSAppOnMac === true;
