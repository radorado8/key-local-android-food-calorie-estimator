import { getGeminiKey } from '../utils/secureStorage';
import { PROMPTS } from '../config/prompts';

export async function analyzeImage({ base64Data, mimeType, weightG, language = 'en', aiModel }) {
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

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `Gemini API Error: ${response.status}`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.error?.message || errMsg;
            } catch { }
            throw new Error(errMsg);
        }

        const data = await response.json();

        // Parse response
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error('No candidates returned from Gemini.');

        const part = candidate.content?.parts?.[0];
        if (!part || !part.text) throw new Error('Empty response from Gemini.');

        const rawText = part.text.trim();

        // Clean markdown code blocks if present (though responseMimeType should prevent this, safety first)
        const jsonStr = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

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
        console.error('Gemini Analysis Failed:', error);
        // Propagate error to be handled by UI (e.g. "not_food" maps to specific message)
        throw error;
    }
}
