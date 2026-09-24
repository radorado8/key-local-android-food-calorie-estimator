import { getActiveApiKey } from '../utils/apiKeys';
import { PROMPTS } from '../config/prompts';
import { parseFoodResult } from './foodResult';

function apiError(status) {
    const error = new Error('ai_request_failed');
    error.provider = 'gemini';
    error.status = status;
    return error;
}

export async function analyzeImage({ base64Data, mimeType, weightG, language = 'en', aiModel, signal, apiKey: suppliedKey }) {
    const apiKey = suppliedKey || await getActiveApiKey('gemini');
    if (!apiKey) {
        throw new Error('Chýba API kľúč. Nastav ho v nastaveniach.');
    }

    // Use selected model or fallback to a sensible default
    const modelId = aiModel || 'gemini-flash-latest';

    // Select prompts for language (fallback to en)
    const prompts = PROMPTS[language] || PROMPTS['en'];

    // Construct instruction based on weight availability
    const weightInstruction = weightG
        ? prompts.weightKnown(weightG)
        : prompts.weightUnknown;

    const textPrompt = prompts.instruction(weightInstruction);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;

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
                    'Content-Type': 'application/json', 'x-goog-api-key': apiKey
                },
                body: JSON.stringify(requestBody),
                signal // Pass abort signal
            });

            if (!response.ok) {
                throw apiError(response.status);
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
                throw new Error("Invalid JSON response from server");
            }

            // Parse response content
            const candidate = data.candidates?.[0];
            if (!candidate) throw new Error('No candidates returned from Gemini.');

            const textContent = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
            if (!textContent) throw new Error('Empty response from Gemini.');
            return parseFoodResult(textContent);

        } catch (error) {
            console.warn(`Attempt ${attempts} failed:`, error.message);

            // Should we retry?
            const isRetryable =
                error.status === 503 || error.status === 429 ||
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
export async function analyzeFoodDescription({ text, audioBase64, audioMimeType, language = 'en', aiModel, signal, apiKey: suppliedKey }) {
    const apiKey = suppliedKey || await getActiveApiKey('gemini');
    if (!apiKey) throw new Error('Chýba API kľúč. Nastav ho v nastaveniach.');

    const modelId = aiModel || 'gemini-flash-latest';
    const outputLanguage = OUTPUT_LANGUAGES[language] || 'English';
    const sourceInstruction = audioBase64
        ? `The user describes a food in the attached audio recording. Transcribe it and use that description. Additional food details: ${JSON.stringify(String(text || '').trim())}.`
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
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1000, responseMimeType: 'application/json' }
            }),
            signal
        }
    );

    if (!response.ok) {
        throw apiError(response.status);
    }

    const payload = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
    if (!rawText) throw new Error('Empty response from Gemini.');
    return parseFoodResult(rawText);
}
