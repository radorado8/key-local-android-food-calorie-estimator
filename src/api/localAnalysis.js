import { classifyImage } from './localClassifier';
import nutritionDB from '../data/nutritionDB.json';

export async function analyzeImageLocal(imageUri) {
    try {
        const { label, confidence } = await classifyImage(imageUri);
        console.log(`Local Classification: ${label} (${(confidence * 100).toFixed(1)}%)`);

        // Basic threshold
        if (confidence < 0.2) {
            return {
                success: false,
                error: "Nízka istota detekcie. Skús odfotiť jedlo zblízka.",
                rawLabel: label
            };
        }

        const nutrition = nutritionDB[label];

        if (!nutrition) {
            return {
                success: false,
                error: `Rozpoznali sme '${label}', ale nemáme k nemu nutričné dáta.`,
                rawLabel: label
            };
        }

        // Map to standard format expected by ScannerScreen
        return {
            success: true,
            name: label.replace(/_/g, ' '), // e.g. "hot_dog" -> "hot dog"
            calories: Math.round(nutrition.calories),
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            weight: 100, // standard 100g base
            analysisMethod: 'local_tflite',
            confidence: confidence
        };

    } catch (error) {
        console.error('Local Analysis Error:', error);
        return {
            success: false,
            error: "Chyba pri lokálnej analýze: " + error.message
        };
    }
}
