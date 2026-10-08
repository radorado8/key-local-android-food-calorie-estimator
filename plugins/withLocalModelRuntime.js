const { withGradleProperties } = require('expo/config-plugins');
module.exports = config => withGradleProperties(config, config => {
  const existing = config.modResults.find(item => item.key === 'rnllamaBuildFromSource');
  if (existing) existing.value = 'false';
  else config.modResults.push({ type: 'property', key: 'rnllamaBuildFromSource', value: 'false' });
  return config;
});
