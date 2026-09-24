# Calories AI Local

A food diary for Android and iOS built with Expo and React Native. Add a meal from a photo, a written description, or a voice recording; review the estimated calories and macronutrients before saving it. Meal history, favorites, and settings are stored on the device.

Food analysis uses **your own API key** for Gemini, OpenAI, or Claude. The app sends the input you choose to analyze to that provider. A network connection and a working provider account are required for AI analysis; the resulting estimates should be checked before use.

## Features

- Analyze food from the camera, photo gallery, text, or a voice recording of up to 30 seconds.
- Track daily calories, protein, carbohydrates, and fat with configurable goals and weekly/monthly analytics.
- Search, edit, repeat, and organize meals in history and multiple favorites lists.
- Import the included 1,000-food USDA starter list. Import/export favorites lists and history as JSON with images; history also supports CSV import/export.
- Choose a Gemini, OpenAI, or Claude model, add custom models, and manage multiple named API keys per provider. Claude voice input needs a Gemini or OpenAI key for transcription.
- Optionally read burned calories from Google Health Connect on Android.
- Use the interface in Slovak, English, Czech, German, Spanish, French, Italian, or Polish.

## Requirements

- Node.js and npm
- Android Studio with an Android SDK and emulator for Android development
- macOS with Xcode and an iOS Simulator for iOS development
- An API key from at least one supported AI provider to analyze food

This app uses native modules, so use a development build rather than Expo Go.

## Run locally

```bash
git clone https://github.com/radorado8/key-local-android-food-calorie-estimator.git
cd key-local-android-food-calorie-estimator
npm ci
```

Start an emulator or simulator, then build and launch the app:

```bash
npm run android
# or, on macOS:
npm run ios
```

These commands create a development build and start Metro. Keep Metro running while using a development build. A production build includes the JavaScript bundle and runs without Metro.

After opening the app, go to **Settings** to select an AI provider and add its API key. Keys are entered in the app; no key needs to be placed in a source file or committed to Git.

## Production builds

The repository's `eas.json` defines a `production` Android App Bundle profile. A maintainer with access to the configured EAS project and Android signing credentials can build it with:

```bash
npx eas-cli build --platform android --profile production
```

For a local production build, add `--local` and prepare the Android SDK and JDK. The production profile uses EAS-managed signing credentials and remote Android version codes. If you fork this repository, configure your own EAS project and signing credentials before publishing an app. Android targets API 36 in `app.json`.

## Data and privacy

Meals, favorites, and settings are stored locally on the device. On Android and iOS, API key values are stored in Expo SecureStore; the app does not include a shared API key. When you request an analysis, the selected text, photo, or audio is sent directly to the chosen AI provider. Claude voice input first sends the recording to the configured transcription provider. Provider usage may incur charges under your own account.

The app has no automatic cloud backup or synchronization. Use the export options in Settings and Favorites to keep copies of your data before changing devices or clearing app storage. JSON exports can include saved images; CSV history exports do not include images.

## Tests

```bash
node --test tests/*.test.cjs
```

The tests cover AI provider/key handling, macronutrient goals, and USDA favorites data. They use simulated API responses; testing a live analysis requires your own provider key.

## Project layout

- `src/screens/` — home, history, favorites, analytics, and settings screens
- `src/api/` — meal storage and AI provider integrations
- `src/data/` — bundled USDA starter list
- `src/i18n/` — interface translations
- `plugins/` — Expo native build configuration
- [`docs/ai-providers.md`](docs/ai-providers.md) — provider, model, key storage, and voice-input details

The bundled food list is derived from USDA FoodData Central SR Legacy and contains no images. See [`src/data/USDA-ATTRIBUTION.md`](src/data/USDA-ATTRIBUTION.md) for its source and attribution details.

## License

No project license has been added yet.
