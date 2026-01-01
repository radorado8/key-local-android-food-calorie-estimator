export const PROMPTS = {
    sk: {
        instruction: (weightInstruction) => `Analyzuj tento obrázok jedla a vráť JSON objekt s nutričnými hodnotami. ${weightInstruction}
Formát:
{
  "name": "Názov jedla (krátky, po slovensky)",
  "calories": číslo (približne kcal),
  "protein": číslo (približne gramy bielkovín),
  "carbs": číslo (približne gramy sacharidov),
  "fat": číslo (približne gramy tukov),
  "weight_g": číslo (odhadovaná hmotnosť v gramoch),
  "confidence": číslo (0.0 až 1.0)
}
Vráť LEN čistý JSON raw string, nič iné. Ak to nie je jedlo, vráť {"error": "not_food"}.`,
        weightKnown: (w) => `Použi zadanú hmotnosť jedla ${w} g. Neodhaduj hmotnosť; nastav "weight_g" presne na ${w}.`,
        weightUnknown: `Odhadni aj hmotnosť jedla v gramoch.`
    },
    en: {
        instruction: (weightInstruction) => `Analyze this food image and return a JSON object with nutritional values. ${weightInstruction}
Format:
{
  "name": "Food name (short, in English)",
  "calories": number (approx kcal),
  "protein": number (approx grams protein),
  "carbs": number (approx grams carbs),
  "fat": number (approx grams fat),
  "weight_g": number (estimated weight in grams),
  "confidence": number (0.0 to 1.0)
}
Return ONLY a raw JSON string, nothing else. If it is not food, return {"error": "not_food"}.`,
        weightKnown: (w) => `Use the provided food weight ${w} g. Do not estimate weight; set "weight_g" exactly to ${w}.`,
        weightUnknown: `Estimate the food weight in grams as well.`
    },
    de: {
        instruction: (weightInstruction) => `Analysiere dieses Essensbild und gib ein JSON-Objekt mit Nährwerten zurück. ${weightInstruction}
Formát:
{
  "name": "Essensname (kurz, auf Deutsch)",
  "calories": Zahl (ca. kcal),
  "protein": Zahl (ca. Gramm Eiweiß),
  "carbs": Zahl (ca. Gramm Kohlenhydrate),
  "fat": Zahl (ca. Gramm Fett),
  "weight_g": Zahl (geschätztes Gewicht in Gramm),
  "confidence": Zahl (0.0 bis 1.0)
}
Gib NUR einen reinen JSON-String zurück, sonst nichts. Wenn es kein Essen ist, gib {"error": "not_food"} zurück.`,
        weightKnown: (w) => `Verwende das angegebene Essensgewicht ${w} g. Schätze das Gewicht nicht; setze "weight_g" genau auf ${w}.`,
        weightUnknown: `Schätze auch das Gewicht des Essens in Gramm.`
    },
    es: {
        instruction: (weightInstruction) => `Analiza esta imagen de comida y devuelve un objeto JSON con valores nutricionales. ${weightInstruction}
Formato:
{
  "name": "Nombre de comida (corto, en español)",
  "calories": número (aprox kcal),
  "protein": número (aprox gramos proteína),
  "carbs": número (aprox gramos carbohidratos),
  "fat": número (aprox gramos grasa),
  "weight_g": número (peso estimado en gramos),
  "confidence": número (0.0 a 1.0)
}
Devuelve SOLO una cadena JSON sin formato, nada más. Si no es comida, devuelve {"error": "not_food"}.`,
        weightKnown: (w) => `Usa el peso de comida proporcionado ${w} g. No estimes el peso; establece "weight_g" exactamente en ${w}.`,
        weightUnknown: `Estima también el peso de la comida en gramos.`
    },
    fr: {
        instruction: (weightInstruction) => `Analysez cette image d'aliment et renvoyez un objet JSON avec les valeurs nutritionnelles. ${weightInstruction}
Format:
{
  "name": "Nom de l'aliment (court, en français)",
  "calories": nombre (env. kcal),
  "protein": nombre (env. grammes protéines),
  "carbs": nombre (env. grammes glucides),
  "fat": nombre (env. grammes lipides),
  "weight_g": nombre (poids estimé en grammes),
  "confidence": nombre (0.0 à 1.0)
}
Renvoyez UNIQUEMENT une chaîne JSON brute, rien d'autre. Si ce n'est pas de la nourriture, renvoyez {"error": "not_food"}.`,
        weightKnown: (w) => `Utilisez le poids d'aliment fourni ${w} g. N'estimez pas le poids ; réglez "weight_g" exactement à ${w}.`,
        weightUnknown: `Estimez également le poids de l'aliment en grammes.`
    },
    pl: {
        instruction: (weightInstruction) => `Przeanalizuj ten obraz jedzenia i zwróć obiekt JSON z wartościami odżywczymi. ${weightInstruction}
Format:
{
  "name": "Nazwa jedzenia (krótka, po polsku)",
  "calories": liczba (ok. kcal),
  "protein": liczba (ok. gramy białka),
  "carbs": liczba (ok. gramy węglowodanów),
  "fat": liczba (ok. gramy tłuszczu),
  "weight_g": liczba (szacowana waga w gramach),
  "confidence": liczba (0.0 do 1.0)
}
Zwróć TYLKO czysty ciąg JSON, nic więcej. Jeśli to nie jedzenie, zwróć {"error": "not_food"}.`,
        weightKnown: (w) => `Użyj podanej wagi jedzenia ${w} g. Nie szacuj wagi; ustaw "weight_g" dokładnie na ${w}.`,
        weightUnknown: `Oszacuj również wagę jedzenia w gramach.`
    },
    cs: {
        instruction: (weightInstruction) => `Analyzuj tento obrázek jídla a vrať JSON objekt s nutričními hodnotami. ${weightInstruction}
Formát:
{
  "name": "Název jídla (krátký, česky)",
  "calories": číslo (přibližně kcal),
  "protein": číslo (přibližně gramy bílkovin),
  "carbs": číslo (přibližně gramy sacharidů),
  "fat": číslo (přibližně gramy tuků),
  "weight_g": číslo (odhadovaná hmotnost v gramech),
  "confidence": číslo (0.0 až 1.0)
}
Vrať JEN čistý JSON raw string, nic jiného. Pokud to není jídlo, vrať {"error": "not_food"}.`,
        weightKnown: (w) => `Použij zadanou hmotnost jídla ${w} g. Neodhaduj hmotnost; nastav "weight_g" přesně na ${w}.`,
        weightUnknown: `Odhadni i hmotnost jídla v gramech.`
    },
    it: {
        instruction: (weightInstruction) => `Analizza questa immagine di cibo e restituisci un oggetto JSON con i valori nutrizionali. ${weightInstruction}
Formato:
{
  "name": "Nome cibo (breve, in italiano)",
  "calories": numero (circa kcal),
  "protein": numero (circa grammi proteine),
  "carbs": numero (circa grammi carboidrati),
  "fat": numero (circa grammi grassi),
  "weight_g": numero (peso stimato in grammi),
  "confidence": numero (0.0 a 1.0)
}
Restituisci SOLO una stringa JSON grezza, nient'altro. Se non è cibo, restituisci {"error": "not_food"}.`,
        weightKnown: (w) => `Usa il peso del cibo fornito ${w} g. Non stimare il peso; imposta "weight_g" a ${w}.`,
        weightUnknown: `Stima anche il peso del cibo in grammi.`
    }
};
