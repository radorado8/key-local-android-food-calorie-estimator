const { withAndroidManifest } = require('expo/config-plugins');

const SCANNER_ACTIVITY = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

module.exports = function withUnrestrictedScannerOrientation(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application?.[0];
    if (!application) return config;

    application.activity = application.activity || [];
    let scannerActivity = application.activity.find(
      (activity) => activity.$?.['android:name'] === SCANNER_ACTIVITY
    );
    if (!scannerActivity) {
      scannerActivity = { $: { 'android:name': SCANNER_ACTIVITY } };
      application.activity.push(scannerActivity);
    }

    scannerActivity.$['tools:remove'] = 'android:screenOrientation';
    return config;
  });
};
