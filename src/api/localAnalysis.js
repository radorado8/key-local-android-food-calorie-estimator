import { classifyImage } from './localClassifier';
import nutritionDB from '../data/nutritionDB.json';

export async function analyzeImageLocal({ imageUri, weightG }) {
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
                error: `Rozpoznalo sa '${label}', ale nie je pridaná nutričná hodnota.`,
                rawLabel: label
            };
        }

        // Calculation Logic
        // nutritionDB values are per 100g
        const finalWeight = weightG ? Number(weightG) : 100;
        const ratio = finalWeight / 100;

        return {
            success: true,
            name: label.replace(/_/g, ' '), // e.g. "hot_dog" -> "hot dog"
            calories: Math.round(nutrition.calories * ratio),
            protein: Math.round(nutrition.protein * ratio * 10) / 10,
            carbs: Math.round(nutrition.carbs * ratio * 10) / 10,
            fat: Math.round(nutrition.fat * ratio * 10) / 10,
            weight_g: finalWeight,
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
