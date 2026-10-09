# Porovnanie Qwen3.5-2B a SmolVLM2-2.2B

Dátum: 8. 10. 2026. Vetva `local_food_model`. iPhone 17e simulátor, iOS 27.0, natívny Release build s llama.rn 0.13.0-rc.7. CPU, bez GPU, kontext 4096, batch 128, teplota 0.1, maximálne 512 výstupných tokenov. Anglický výstup. Simulátor používa hardvér Macu; časy nie sú merania výkonu reálneho iPhonu ani Samsungu.

## Súbory

- [Qwen – LM Studio Community](https://huggingface.co/lmstudio-community/Qwen3.5-2B-GGUF): `Qwen3.5-2B-Q4_K_M.gguf` (1 270 808 032 B) + `mmproj-Qwen3.5-2B-BF16.gguf` (671 372 416 B).
- [SmolVLM – ggml-org](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF): `SmolVLM2-2.2B-Instruct-Q4_K_M.gguf` (1 112 602 656 B) + `mmproj-SmolVLM2-2.2B-Instruct-f16.gguf` (872 303 680 B).

## Výsledky cez aktuálnu aplikáciu

Prvý priechod používal priamo `analyzeLocally` s predvoleným natívnym formátovaním (jinja=false pre tieto architektúry). Každé zadanie otvorilo a uvoľnilo nový kontext. Fotografia bola rovnaký pomaranč ako pri Gemme, hmotnosť zadaná 100 g. Jedlá sa neukladali; dočasné nastavenia sa obnovili.

| Model | Vstup | Čas | Výsledok |
| --- | --- | --- | --- |
| qwen | 100 g jablko | 10.0 s | apple; 0 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| qwen | 100 g rozok s maslom | 10.9 s | Rozok s maslom; 0 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| qwen | 100 g rožok s maslom | 11.2 s | Rozok s maslom; 0 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| qwen | 100 g bread with butter | 10.1 s | Bread with butter; 0 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| qwen | auto na parkovisku | 10.0 s | not_food |
| qwen | Fotografia pomaranča | 213.2 s | Orange; 52 kcal; B 0.4 g / S 11.6 g / T 0.1 g; 100 g |
| smol | 100 g jablko | 11.1 s | apple; 95 kcal; B 0.5 g / S 15.3 g / T 0.3 g; 100 g |
| smol | 100 g rozok s maslom | 10.7 s | rozok s maslom; 100 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| smol | 100 g rožok s maslom | 10.8 s | rožok s maslom; 100 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| smol | 100 g bread with butter | 10.6 s | Bread with butter; 200 kcal; B 0 g / S 0 g / T 0 g; 100 g |
| smol | auto na parkovisku | 10.3 s | auto na parkovisku; 0 kcal; B 0 g / S 0 g / T 0 g; 0 g |
| smol | Fotografia pomaranča | 48.0 s | orange; 52 kcal; B 0.5 g / S 12.5 g / T 0.2 g; 120 g |

## Diagnostický priechod s Jinja

Druhý priechod používal rovnaké modely, schému a CPU parametre, ale Jinja šablónu a opakovane jeden kontext pre texty aj fotografiu daného modelu. Qwen pridával `<|im_start|>assistant`, SmolVLM `Assistant:` pred JSON; aktuálny parser výsledky odmietol. Nejde o nepodporovanú architektúru, ale nevhodný výstupný obal. Ani po odhliadnutí od obalu neboli textové nutričné výsledky spoľahlivé. Túto zmenu formátovania sme nezapli v bežnej aplikácii.

- qwen, fotografia, Jinja: 213.4 s; výstup odmietnutý parserom kvôli obalu.
- smol, fotografia, Jinja: 43.5 s; výstup odmietnutý parserom kvôli obalu.

## Záver

Oba modely sa úspešne načítali a prijali text aj obraz. Qwen v aktuálnom režime pri všetkých štyroch textových jedlách vrátil nulové kalórie a makrá; fotografiu rozpoznal, ale približne za 213 s. SmolVLM fotografiu rozpoznal za približne 48 s, no ignoroval zadanú hmotnosť (120 g namiesto 100 g), vracal nulové makrá pri pečive a nejedlý vstup označil ako jedlo s nulovými hodnotami. Anglické názvy pri slovenskom pečive nedodržal ani jeden.

Tieto malé testy nepodporujú nasadenie ani jedného modelu ako spoľahlivej náhrady cloudovej nutričnej analýzy. SmolVLM je zaujímavý kandidát na rýchle rozpoznanie potraviny, ak sa výživa následne vypočíta z databázy a explicitnej hmotnosti. Gemma pri predchádzajúcom teste mala lepšie základné výsledky, ale aj ona má chyby pri slovenských jedlách. Nejde o reprezentatívny benchmark ani potvrdenie nutričnej presnosti.

Surové výsledky sú v ignorovanom `build/model-comparison/app-results.json` a `build/model-comparison/jinja-results.json`. Modelové váhy ani testovací automatický štart nie sú súčasťou aplikácie alebo Git repozitára.
