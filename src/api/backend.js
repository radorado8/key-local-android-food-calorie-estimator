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

export function getFriendlyError(err, t) {
  const msg = err?.message || 'Unknown error';
  const getText = (key, fallback) => t ? t[key] : fallback;

  if (msg === 'not_food') {
    return {
      title: getText('errNotFoodTitle', 'Nerozpoznané'),
      message: getText('errNotFoodMsg', 'Toto nevyzerá ako jedlo. Skús to odfotiť znova alebo z iného uhla.')
    };
  }
  if (msg.includes('Invalid format from AI') || msg.includes('Unexpected end of input')) {
    return {
      title: getText('errAiTitle', 'Chyba AI'),
      message: getText('errAiMsg', 'Umelá inteligencia neodpovedala správne. Skús to prosím znova.')
    };
  }
  if (msg.includes('Network request failed')) {
    return {
      title: getText('errNetworkTitle', 'Chyba siete'),
      message: getText('errNetworkMsg', 'Skontroluj pripojenie na internet.')
    };
  }

  // New: Handle Server/JSON Errors (503, 500, Bad JSON)
  const isServerBusy = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded') || msg.includes('Empty response');
  const isJsonError = msg.includes('JSON Parse error') || msg.includes('Unexpected token') || msg.includes('SyntaxError');

  if (isServerBusy || isJsonError) {
    return {
      title: getText('errServerBusyTitle', 'Server je zaneprázdnený'),
      message: getText('errServerBusyMsg', 'Skúste neskôr alebo iný model (Gemini).')
    };
  }

  return { title: getText('errorTitle', 'Chyba'), message: msg };
}

import { analyzeImage, analyzeFoodDescription } from './gemini';

// ... (BackendError class stays)

export async function analyzeFood(payload) {
  return analyzeImage(payload);
}

export async function analyzeFoodDescriptionInput(payload) {
  return analyzeFoodDescription(payload);
}

