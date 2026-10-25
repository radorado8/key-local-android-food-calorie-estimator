# Calories AI Key — App Review information

Draft for the response to App Review and for future review reference. This document addresses the written information requested under Guideline 2.1. The physical-device demonstration video and reviewer access to AI analysis still need to be supplied before resubmission.

## 1. Purpose, intended audience and value

Calories AI Key is a personal food diary and calorie/macronutrient tracker for adults who want to understand their food intake and compare it with available energy expenditure data. Users can record meals manually or request estimated nutritional values from their chosen AI provider using photos, text or voice.

The app reduces the effort involved in keeping a food diary. Users can review and correct estimates, repeat previously saved meals, organize favorites, set daily calorie and macronutrient goals, and explore intake and expenditure trends over time. Photo analysis can use up to four images and accompanying text, for example a meal photo together with a nutrition label or portion-weight information.

The app is intended for general wellness and personal record keeping. It does not diagnose, treat or prevent disease and is not presented as a medical device. Nutrition, portion-weight and energy estimates can be inaccurate and should be checked by the user.

## 2. Setup and access to the main features

No Calories AI account, registration or sign-in is required. There is therefore no app account deletion flow. Users can delete local diary data within the app.

To test without an AI API key:

1. Launch the app and accept the displayed terms.
2. Open History (Food Log), choose the manual Add Meal option, enter the food name, portion weight and nutritional values, then save. The selected meal date and time can also be edited.
3. Open Home to view the daily calorie and macronutrient totals and goals.
4. Tap a meal in History to edit it. Use the plus button to repeat a saved meal, or press and hold it to specify a different portion weight.
5. Save a meal to Favorites and open Favorites to organize or reuse saved foods.
6. Open Analytics to explore weekly, two-week, monthly and yearly views and the available date-range controls.
7. Open Settings to adjust goals, appearance, language, meal times and export/import options. The diary, favorites and preferences are stored locally on the device.

To use optional AI analysis:

1. Open Settings, select Gemini, OpenAI or Claude, add an API key for that provider, and select a supported model. The user supplies their own provider account and API key. Provider charges and usage limits may apply independently of this app.
2. On Home, use Camera, Gallery or Text to submit a meal for analysis. The Photos and text flow supports up to four photos and an optional description.
3. Review the returned estimates, edit them if necessary, and save the meal. History displays the first photo.
4. Voice input records up to 30 seconds. Gemini can process voice through its API. OpenAI uses its transcription API. For Claude voice input, a separate Gemini or OpenAI transcription provider and its API key must be configured in Settings.

To use optional Apple Health integration:

1. Enable Apple Health in Settings and grant the requested read permissions on a supported physical device.
2. The app reads active and resting energy, forms the total calories burned, and displays expenditure alongside food intake on Home and in Analytics.
3. If no readable energy data exists, the app cannot display measured expenditure. Diary entry remains available without Health access.
4. The app does not write data to Apple Health. Users can disable the integration and manage permissions through Apple's Health/settings interfaces.

Reviewer access to AI analysis: to be provided separately before resubmission. The app does not contain a shared API key or an app login. This draft does not claim that a working reviewer API key has already been supplied.

## 3. External services and platforms

- Google Gemini API: optional food analysis from photos, text and voice, including transcription when selected for the Claude voice flow.
- OpenAI API: optional food analysis from photos/text and audio transcription.
- Anthropic Claude API: optional food analysis from photos/text. Claude voice input uses a separately configured transcription service as described above.
- Apple Health / HealthKit: optional reading of active and resting energy expenditure on iOS. Health history is not automatically transmitted to an AI provider.
- Android Health Connect: used by the Android edition only, not by the submitted iOS edition.
- Firebase Hosting: hosts the public information website and privacy policy. It is not used as a cloud store for the iOS meal diary.
- USDA-derived food data: an optional bundled favorites library; it is not a live dependency for AI analysis.

AI requests are sent to the provider selected by the user. The selected photos, meal text or voice/transcript needed for the request leave the device. The full diary and Health history are not automatically sent for analysis. There is no required Calories AI authentication service, advertising service, in-app purchase or in-app payment processor.

Privacy policy: https://kalorie-jedlo-web-rot.web.app/privacy.html
Support: https://github.com/radorado8/key-local-android-food-calorie-estimator/issues

## 4. Regional behavior

The app does not intentionally vary its core diary, favorites, goals or analytics features by region. Interface language, dates, numbers and the user's selected preferences can affect presentation.

Optional AI features depend on the selected provider's regional availability, account eligibility, model access, API billing, service limits and internet connectivity. We do not claim that every AI provider is available in every country. Apple Health functionality also depends on device/OS support, granted permissions and available data.

## 5. Regulated content and third-party materials

The app is a general wellness food diary. It does not provide medical diagnosis or treatment, regulated financial services, gambling, or a marketplace for regulated goods. It has no public social feed, user-to-user messaging, or public sharing of user-generated content inside the app. Personal diary entries are not a public content platform.

Users select or capture their own meal images. The developer does not claim ownership of user-supplied images. Optional AI services are accessed through the user's provider account and remain subject to that provider's terms.

The illustrative food photos used in the App Store screenshots are public-domain or CC0 materials, with the following sources and credits:

1. Fresh muesli — Markus Kuhn; released into the public domain.
   https://commons.wikimedia.org/wiki/File:Fresh-muesli.jpg
2. Oatmeal yogurt bars — Fumikas Sagisavas; CC0 1.0 Universal Public Domain Dedication.
   https://commons.wikimedia.org/wiki/File:Oatmeal_yogurt_bars.jpg
3. Chicken and rice — Renee Comet / National Cancer Institute; identified by the source as public domain.
   https://commons.wikimedia.org/wiki/File:Chicken_and_rice.jpg

The screenshot meals and Health readings are illustrative sample data. The screenshot-only simulated Health source is not included in the submitted production build. A review demonstration recorded on a physical device must use the production app and actual available device data, rather than presenting simulated readings as Health measurements.

## Completion checklist — not part of the reply to Apple

- Record the production app on a physical iPhone running the latest released iOS, starting with launching the app and showing the normal user flow.
- Supply the video or a working reviewer-accessible video link.
- Decide how the reviewer can test AI analysis without having to purchase their own API access; do not place a personal unrestricted API key in a public file or video.
- Confirm the final build number, physical-device test results and any supported iPad testing before making claims about them.
- Copy the final information into the App Review reply and the App Review Information Notes field. Use the accompanying shorter notes file for the 4,000-character Notes field.
