# Poskytovatelia AI

V Nastaveniach vyber Gemini, OpenAI alebo Claude. Každá služba má vlastný model a zoznam pomenovaných API kľúčov. Ťuknutím na kľúč ho aktivuješ; ceruzka upraví názov alebo nahradí kľúč. Prázdne pole pri úprave ponechá pôvodný kľúč. Pri zmazaní aktívneho kľúča sa vyberie ďalší kľúč tej istej služby, ak existuje.

Kľúče sa automaticky nestriedajú pri vyčerpaní kreditu ani pri chybe. API požiadavky používajú používateľov vlastný účet. História a obľúbené sa nemenia.

## Podporované vstupy

| Poskytovateľ | Text / fotografia | Hlas |
| --- | --- | --- |
| Gemini | Gemini generateContent | Priame spracovanie nahrávky |
| OpenAI | Responses API, predvolený GPT-4.1 mini | Prepis gpt-4o-mini-transcribe, následne analýza zvoleným modelom |
| Claude | Messages API, predvolený Haiku 4.5 | Vyžaduje výslovný výber Gemini alebo OpenAI na prepis a aktívny kľúč tejto služby; text sa následne analyzuje cez Claude |

Pôvodný 30-sekundový limit nahrávania zostáva. Hlas pre Claude je predvolene vypnutý. Služby sa nemenia automaticky. Vlastný model musí podporovať obrazový vstup a príslušný spôsob štruktúrovaného výstupu (OpenAI JSON schema / Claude vynútené volanie nástroja); samotné uloženie jeho ID dostupnosť na API účte neoveruje.

## Uloženie a migrácia

- Tajomstvá sú na Androide/iOS v Expo SecureStore, každé pod samostatným identifikátorom. Na webe sa používa localStorage rovnako ako predtým.
- AsyncStorage obsahuje iba názvy, identifikátory a aktívny výber (`ai-key-index.v1`); tajomstvá nie sú súčasťou bežných nastavení ani exportu jedál.
- Pôvodný `gemini_api_key` sa prenesie pri prvom otvorení nastavení alebo analýze. Pôvodná hodnota sa odstráni až po uložení nového kľúča a indexu. Existencia indexu zabráni opätovnému vytvoreniu zmazaného kľúča.
- Zmeny kľúčov sú serializované. Náhrada najprv uloží nové tajomstvo, potom index a až nakoniec odstráni staré tajomstvo. Chyba zápisu indexu zachová pôvodný kľúč.
- Pôvodné `aiModel` a vlastné modely bez atribútu `provider` zostávajú priradené Gemini. Nové modely sú oddelené podľa poskytovateľa.

## Overenie

`node --test tests/*.test.cjs`

Testy zahŕňajú migráciu, reštart, paralelné ukladanie, chyby úložiska, prepínanie a mazanie kľúčov, zachovanie nastavení, smerovanie fotiek/textu/hlasu, zrušenie požiadavky, neplatné výsledky a chybové stavy API. API odpovede sú v testoch simulované; živú analýzu treba preveriť s vlastným funkčným kľúčom každej služby.

Použité rozhrania: [OpenAI Responses a štruktúrovaný výstup](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI prepis hlasu](https://developers.openai.com/api/docs/guides/speech-to-text), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [Claude obrazový vstup](https://platform.claude.com/docs/en/build-with-claude/vision).
