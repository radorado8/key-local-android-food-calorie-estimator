const { withMainApplication } = require('expo/config-plugins');

// Prebuilt React Native libraries expose their own (release) BuildConfig.DEBUG.
// Use the application's build type when creating the new Expo ReactHost instead.
module.exports = config => withMainApplication(config, mod => {
  const source = mod.modResults.contents;
  if (source.includes('ExpoReactHostFactory.getDefaultReactHost(') && !source.includes('useDevSupport = BuildConfig.DEBUG')) {
    const anchor = 'context = applicationContext,';
    if (!source.includes(anchor)) throw new Error('Review Expo ReactHost template before applying dev support configuration.');
    mod.modResults.contents = source.replace(anchor, `${anchor}\n      useDevSupport = BuildConfig.DEBUG,`);
  }
  return mod;
});
