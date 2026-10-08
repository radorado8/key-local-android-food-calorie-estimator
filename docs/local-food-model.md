# Experimentálny lokálny model

Vetva `local_food_model` pridáva poskytovateľa **Local AI** cez `llama.rn` 0.13.0-rc.7. Model nie je súčasťou APK/AAB ani Git repozitára. V nastaveniach sa importuje `.gguf` a pre fotografie aj jeho zodpovedajúci obrazový projektor `.gguf` (mmproj). Súbory zostávajú v súkromnom úložisku aplikácie; uložené relatívne názvy prežijú zmenu iOS kontajnera. Zmazanie modelov nemení jedlá ani fotografie.

Analýza používa CPU, jeden požiadavkový kontext a vynútenú JSON schému. Po dokončení alebo chybe uvoľní kontext. Súbežná analýza/import sú odmietnuté; zrušenie požiadavky zastaví generovanie. Režim neposiela vstupy do cloudu a nepotrebuje API kľúč. Hlas zatiaľ odmieta s vysvetlením; neprepína sa automaticky na platené API.

## Boba 0.8B

Zdroj: https://huggingface.co/Doses-AI/boba-0.8b-food-GGUF (Apache 2.0).

Odporúčaný mobilný variant: `sift-q4km.gguf` (529 MB) + `sift-mmproj-f16.gguf` (205 MB). Pôvodný používateľov `sift-f16.gguf` má 1.52 GB; na emulátore s približne 2.5 GB RAM test generovania nebol dokončený a emulátor sa reštartoval. Menší Q4 model bol overený v Android emulátore so 4 GB RAM: načítanie, obrazový projektor (vision=true, audio=false), anglický a slovenský text a JSON výstup. Textová generácia v tomto teste trvala približne 1.4 s na zadanie; nejde o meranie výkonu reálneho telefónu.

Model je doladený na anglický obrazový dataset Nutrition5k. Slovenčina, preklad názvov ani textové výživové odhady nie sú spoľahlivé. Pri „100 g jablko“ test vrátil 10 g a nespoľahlivé makrá. Preto ide o experiment, nie produkčnú náhradu cloudových poskytovateľov. Vynútená schéma opravuje formát, nie správnosť výživových údajov.

Používateľova cesta `~/.lmstudio/hub/models/google/gemma-3-4b` obsahuje katalógové metadáta, nie GGUF váhy. Stiahnutý Gemma 3 model v inom priečinku je vo formáte MLX a nie je priamo importovateľný do llama.rn; potrebuje GGUF a zodpovedajúci projektor.

## Build a overenie

- Native moduly vyžadujú nový Android/iOS build; Expo Go nestačí.
- Expo plugin zachová R8 pravidlá pre `com.rnllama` a nastaví použitie dodaných natívnych binárok.
- Pri zablokovaných npm lifecycle skriptoch spusti `node node_modules/llama.rn/install/download-native-artifacts.js`.
- `node --test tests/localModel.test.cjs tests/aiProviders.test.cjs`: 28 testov.
- Android testovací build: `./android/gradlew -p android assembleDebug -PreactNativeArchitectures=arm64-v8a -PrnllamaBuildFromSource=false`.
- iOS build zatiaľ nebol vykonaný.

Pri obrazovom teste na fotografii pomaranča model vrátil názov `orange`, ale zároveň nesprávny príznak `not_food` a nesprávnu hmotnosť. Aplikácia tento výsledok odmietne. Obrazový vstup technicky funguje, kvalita výživového výsledku na tomto modeli zatiaľ neprešla overením.
