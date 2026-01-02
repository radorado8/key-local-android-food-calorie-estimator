import { getAppConfig } from '../config/appConfig';

export class BackendError extends Error {
  constructor({ status, error, message, payload }) {
    super(message || error || 'Backend error');
    this.name = 'BackendError';
    this.status = status;
    this.error = error;
    this.payload = payload;
  }
}

export function getFriendlyError(err) {
  const msg = err?.message || 'Unknown error';

  if (msg === 'not_food') {
    return { title: 'Nerozpoznané', message: 'Toto nevyzerá ako jedlo. Skús to odfotiť znova alebo z iného uhla.' };
  }
  if (msg.includes('Invalid format from AI') || msg.includes('Unexpected end of input')) {
    return { title: 'Chyba AI', message: 'Umelá inteligencia neodpovedala správne. Skús to prosím znova.' };
  }
  if (msg.includes('Network request failed')) {
    return { title: 'Chyba siete', message: 'Skontroluj pripojenie na internet.' };
  }

  return { title: 'Chyba', message: msg };
}

import { analyzeImage } from './gemini';
import { analyzeImageLocal } from './localAnalysis';
import { getGeminiKey } from '../utils/secureStorage';

// ... (BackendError class stays)

export async function analyzeFood(payload) {
  // Determine Mode
  const { analysisMode = 'auto' } = payload;

  let useLocal = false;

  if (analysisMode === 'local') {
    useLocal = true;
  } else if (analysisMode === 'auto') {
    // Check if we have a key
    try {
      const apiKey = await getGeminiKey();
      if (!apiKey) {
        console.log('Auto Mode: No API Key found, falling back to Local Analysis.');
        useLocal = true;
      }
    } catch (e) {
      useLocal = true;
    }
  }

  if (useLocal) {
    // Call Local TFLite Service
    // Note: Local service expects 'imageUri' which is usually available in payload or we reconstruct it
    // payload usually has base64Data, mimeType, etc.
    // Local classifier needs a URI to load via ImageManipulator/Skia.
    // If payload only has base64, we might need to verify inputs.
    // Assuming payload.imageUri is passed from ScannerScreen.
    if (!payload.imageUri) {
      throw new Error('Local Analysis requires imageUri');
    }
    // Pass full payload (contains weightG, etc.)
    const result = await analyzeImageLocal({
      imageUri: payload.imageUri,
      weightG: payload.weightG,
      language: payload.language // Pass language for localization
    });
    if (!result.success) {
      throw new Error(result.error || 'Local Analysis Failed');
    }
    return result;
  } else {
    // Call Cloud Gemini Service
    return await analyzeImage(payload);
  }
}


// Deprecated/Unused in Local Mode
export async function createMeal() { throw new Error('Not supported in Local Mode'); }
export async function updateMeal() { throw new Error('Not supported in Local Mode'); }
export async function deleteMeal() { throw new Error('Not supported in Local Mode'); }
export async function exportUserData() { throw new Error('Use Export CSV in Settings'); }

