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
- iOS Release simulator build s prebuilt llama.rn úspešne zostavený a spustený (8. 10. 2026).

Pri obrazovom teste na fotografii pomaranča model vrátil názov `orange`, ale zároveň nesprávny príznak `not_food` a nesprávnu hmotnosť. Aplikácia tento výsledok odmietne. Obrazový vstup technicky funguje, kvalita výživového výsledku na tomto modeli zatiaľ neprešla overením.

## Gemma 4 E2B – iPhone 17e simulátor (8. 10. 2026)

Testované používateľove lokálne súbory `gemma-4-E2B-it-Q4_K_M.gguf` (3.43 GB) a `mmproj-gemma-4-E2B-it-BF16.gguf` (0.99 GB). Natívny iOS Release build s llama.rn 0.13.0-rc.7 úspešne prešiel. Test CPU, kontext 2048, batch 128, 512 výstupných tokenov, bez Metal. Simulátor iPhone 17e / iOS 27.0 využíva hardvér Macu; výsledok nepotvrdzuje pamäťový limit ani výkon reálneho telefónu.

Gemma 4 vyžaduje Jinja šablónu. Pôvodné `jinja: false` skončilo chybou `this custom template is not supported, try using --jinja`. Aplikácia teraz vyberá Jinja podľa GGUF architektúry `gemma4`; Boba si ponecháva overený pôvodný režim.

Výsledky technického testu (nejde o hodnotenie presnosti na reprezentatívnom datasete):

- Načítanie modelu: približne 1.5 s.
- „100 g jablko“: 13.5 s; jablko, 52 kcal, 0.3 g bielkovín, 13.8 g sacharidov, 0.2 g tuku, 100 g. Výstup prešiel parserom aplikácie.
- „100 g rozok s maslom“ bez diakritiky: 6.2 s; nesprávne `not_food`. Aplikácia ho odmietne.
- Fotografia pomaranča: 113.9 s; 47 kcal, 0.9 g bielkovín, 11.7 g sacharidov, 0.1 g tuku, 100 g, ale chybný slovenský názov „Portáčik“.
- Projektor sa inicializoval a oznámil `vision=true, audio=true`. Zvuková analýza nebola testovaná a aplikácia hlas stále výslovne odmieta.

Model technicky funguje pre text aj obraz, ale kvalita slovenčiny a rozpoznania potrebuje ďalšie ladenie a testy. Zatiaľ sa nemá považovať za produkčnú náhradu cloudu. Ďalší krok pre výkon je Metal na reálnom iPhone a meranie pamäte. Testovací vstupný bod a výsledky sú iba v ignorovanom `build/gemma-ios-test`; nie sú súčasťou bežného spustenia ani produkčného buildu. Test neukladal výsledné jedlá do histórie.

## Výsledky v angličtine (8. 10. 2026)

Pri Local AI je uložená samostatná voľba jazyka výsledkov: **Angličtina** (predvolená) alebo **Jazyk aplikácie**. Jazyk rozhrania ani existujúce jedlá sa nemenia. Nastavenie prežije výmenu a zmazanie modelových súborov. Anglický režim pridáva explicitný pokyn preložiť názov jedla do angličtiny; nie je to garancia dodržania pokynov každým modelom.

Opakovaný test v iPhone 17e simulátore použil priamo `analyzeLocally`, skutočné Gemma GGUF súbory, kontext 4096 a slovenský jazyk rozhrania. Posilnený pokyn dával tieto výsledky:

| Vstup | Výsledok | Čas |
| --- | --- | --- |
| 100 g jablko | apple, 43 kcal, 100 g | 15.9 s |
| 100 g rozok s maslom | potatoes with butter – nesprávne rozpoznanie | 16.1 s |
| 100 g rožok s maslom | not_food – nesprávne odmietnutie | 14.9 s |
| 100 g bread with butter | bread with butter, 340 kcal, 100 g | 16.0 s |
| auto na parkovisku | not_food – správne odmietnutie | 16.0 s |
| Fotografia pomaranča, 100 g | Orange, 47 kcal, 0.9 g bielkovín, 11.8 g sacharidov, 0.1 g tuku, 100 g | 117.2 s |

Slabší pôvodný pokyn v prvom anglickom teste ponechal názov „rožok s maslom“ po slovensky; nejedlý vstup a fotografia skončili neplatným formátom. Posilnenie pokynu pomohlo formátu a angličtine, ale nevyriešilo rozpoznávanie slovenského pečiva. Model preto stále zostáva experimentálny. Výsledky sú odhady modelu, nie overené výživové merania.

31 automatizovaných testov (`localModel` + `aiProviders`) prešlo vrátane predvolenej angličtiny, voľby jazyka aplikácie pre text aj fotografiu a zachovania nastavenia po výmene modelu. Ignorované výsledky natívneho testu: `build/gemma-ios-test/english-final-results.json`. Test dočasné nastavenia obnovil a žiadne jedlá neuložil.

## Stiahnutie do mobilu

Na spodku nastavení Local AI sú odkazy na model aj zodpovedajúci projektor pre Gemma 4 E2B Q4_K_M a Boba 0.8B Q4_K_M. Otvárajú priamy Hugging Face download v systémovom prehliadači. Používateľ uloží obidva súbory do Downloads a importuje ich existujúcimi tlačidlami. Import vytvára súkromnú kópiu, preto treba miesto aj na stiahnuté súbory, aj na kópiu; po úspešnom importe sa môžu pôvodné downloady zmazať. Karta obsahuje aj odkaz na modelovú stránku a licenciu.

## Bezpečný štart aplikácie

Modelové váhy sa načítajú výlučne po explicitnom spustení analýzy. Čítanie nastavení aj štart aplikácie čítajú iba uložené názvy súborov; ani natívny modul llama.rn sa neimportuje, kým nezačne import GGUF alebo analýza. Po reštarte sa nedokončená analýza automaticky neopakuje. Kontekst sa po úspechu aj zachytiteľnej chybe uvoľní. Natívny pád či ukončenie pre nedostatok pamäte počas analýzy nemožno zachytiť v JavaScripte, ale ďalší štart model znovu nenačíta. Regresný test overuje čítanie uloženého modelu bez importu natívneho runtime a bez načítania váh.
