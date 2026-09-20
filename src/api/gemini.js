import { getGeminiKey } from '../utils/secureStorage';
import { PROMPTS } from '../config/prompts';

export async function analyzeImage({ base64Data, mimeType, weightG, language = 'en', aiModel, signal }) {
    const apiKey = await getGeminiKey();
    if (!apiKey) {
        throw new Error('Chýba API kľúč. Nastav ho v nastaveniach.');
    }

    // Use selected model or fallback to a sensible default
    const modelId = aiModel || 'gemini-1.5-flash';

    // Select prompts for language (fallback to en)
    const prompts = PROMPTS[language] || PROMPTS['en'];

    // Construct instruction based on weight availability
    const weightInstruction = weightG
        ? prompts.weightKnown(weightG)
        : prompts.weightUnknown;

    const textPrompt = prompts.instruction(weightInstruction);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: textPrompt },
                    {
                        inline_data: {
                            mime_type: mimeType || 'image/jpeg',
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2, // Low temperature for factual JSON
            maxOutputTokens: 1000,
            responseMimeType: "application/json" // Enforce JSON mode
        }
    };

    // Retry logic
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            if (signal?.aborted) {
                throw new Error('Aborted'); // Throw generic to be caught
            }

            console.log(`Gemini API Request (Attempt ${attempts}/${maxAttempts})...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal // Pass abort signal
            });

            if (!response.ok) {
                const errText = await response.text();
                // If 503 (Service Unavailable) or 429 (Too Many Requests), throw to trigger retry
                if (response.status === 503 || response.status === 429) {
                    throw new Error(`Server Busy (${response.status})`);
                }

                let errMsg = `Gemini API Error: ${response.status}`;
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.error?.message || errMsg;
                } catch { }
                // Fatal error, don't retry unless network
                throw new Error(errMsg);
            }

            // Safe JSON Parsing
            const rawText = await response.text();

            if (!rawText || !rawText.trim()) {
                throw new Error('Empty response from backend');
            }

            let data;
            try {
                data = JSON.parse(rawText);
            } catch (jsonErr) {
                console.error("Gemini JSON Parse Error. Raw response:", rawText);
                throw new Error("Invalid JSON response from server");
            }

            // Parse response content
            const candidate = data.candidates?.[0];
            if (!candidate) throw new Error('No candidates returned from Gemini.');

            const part = candidate.content?.parts?.[0];
            if (!part || !part.text) throw new Error('Empty response from Gemini.');

            const textContent = part.text.trim();

            // Clean markdown code blocks if present
            const jsonStr = textContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');

            const result = JSON.parse(jsonStr);

            if (result.error === 'not_food') {
                throw new Error('not_food');
            }

            // Sanitize numbers
            return {
                name: result.name || 'Unknown Food',
                calories: Number(result.calories) || 0,
                protein: Number(result.protein) || 0,
                carbs: Number(result.carbs) || 0,
                fat: Number(result.fat) || 0,
                weight_g: Number(result.weight_g) || 0,
                confidence: Number(result.confidence) || 0.5
            };

        } catch (error) {
            console.warn(`Attempt ${attempts} failed:`, error.message);

            // Should we retry?
            const isRetryable =
                error.message.includes('Network request failed') ||
                error.message.includes('Server Busy') ||
                error.message.includes('Empty response') ||
                error.message.includes('Invalid JSON') ||
                error.message.includes('Unexpected end of input');

            if (attempts >= maxAttempts || !isRetryable) {
                console.error('Gemini Analysis Failed after retries:', error);
                throw error;
            }

            // Wait before retry (1s, 2s, 3s...)
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}

const OUTPUT_LANGUAGES = {
    sk: 'Slovak', en: 'English', de: 'German', es: 'Spanish',
    fr: 'French', pl: 'Polish', cs: 'Czech', it: 'Italian'
};

/** Analyze a typed food description or a short voice recording, without an image. */
export async function analyzeFoodDescription({ text, audioBase64, audioMimeType, language = 'en', aiModel, signal }) {
    const apiKey = await getGeminiKey();
    if (!apiKey) throw new Error('Chýba API kľúč. Nastav ho v nastaveniach.');

    const modelId = aiModel || 'gemini-1.5-flash';
    const outputLanguage = OUTPUT_LANGUAGES[language] || 'English';
    const sourceInstruction = audioBase64
        ? 'The user describes a food in the attached audio recording. Transcribe it and use that description.'
        : `The user describes this food: "${String(text || '').trim()}".`;
    const prompt = `${sourceInstruction}
Estimate one serving and return its nutritional values. Return the food name in ${outputLanguage}.
Format:
{
  "name": "short food name",
  "calories": number (approx kcal),
  "protein": number (approx grams protein),
  "carbs": number (approx grams carbs),
  "fat": number (approx grams fat),
  "weight_g": number (estimated weight in grams),
  "confidence": number (0.0 to 1.0)
}
Return ONLY a raw JSON string, nothing else. If it is not food, return {"error":"not_food"}.`;

    const parts = [{ text: prompt }];
    if (audioBase64) {
        parts.push({ inline_data: { mime_type: audioMimeType || 'audio/mp4', data: audioBase64 } });
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1000, responseMimeType: 'application/json' }
            }),
            signal
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        let message = `Gemini API Error: ${response.status}`;
        try { message = JSON.parse(errorText).error?.message || message; } catch { }
        throw new Error(message);
    }

    const payload = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini.');
    const parsed = JSON.parse(rawText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    if (parsed.error === 'not_food') throw new Error('not_food');

    return {
        name: parsed.name || 'Unknown Food',
        calories: Number(parsed.calories) || 0,
        protein: Number(parsed.protein) || 0,
        carbs: Number(parsed.carbs) || 0,
        fat: Number(parsed.fat) || 0,
        weight_g: Number(parsed.weight_g) || 0,
        confidence: Number(parsed.confidence) || 0.5
    };
}
