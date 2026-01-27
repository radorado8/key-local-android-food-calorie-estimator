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
