import Constants from 'expo-constants';

function getExtra() {
  // Expo SDK 52: Constants.expoConfig is available at runtime.
  return (
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    {}
  );
}

export function getAppConfig() {
  const extra = getExtra();

  return {
    functionsBaseUrl: String(extra?.functionsBaseUrl || '').trim(),
    allowedEmails: Array.isArray(extra?.allowedEmails) ? extra.allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [],
    googleAuth: {
      expoClientId: String(extra?.googleAuth?.expoClientId || '').trim(),
      androidClientId: String(extra?.googleAuth?.androidClientId || '').trim(),
      webClientId: String(extra?.googleAuth?.webClientId || '').trim(),
    },
    DAILY_ANALYSIS_LIMIT: 70,
  };
}
