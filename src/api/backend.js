import { analyzeWithProvider } from './providers';
import { AI_PROVIDERS } from '../config/aiProviders';

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
  const getText = (key, fallback) => t?.[key] || fallback;
  const provider = AI_PROVIDERS.find(item => item.id === err?.provider)?.label || 'AI';
  if (msg === 'missing_api_key') return { title: getText('errorTitle', 'Error'), message: provider + ': ' + getText('aiMissingKey', 'Add and select an API key in Settings.') };
  if (msg === 'claude_voice_setup') return { title: 'Claude', message: getText('aiVoiceHint', 'Select Gemini or OpenAI for voice transcription in Settings.') };
  if (msg === 'invalid_api_key') return { title: getText('errorTitle', 'Error'), message: getText('aiInvalidKey', 'Enter an API key without spaces.') };
  if (msg === 'empty_transcription' || msg === 'missing_audio') return { title: getText('errorTitle', 'Error'), message: getText('aiEmptyVoice', 'No speech recognized. Please record again.') };
  if (msg === 'ai_request_failed') {
    if (err.reason === 'billing') return { title: provider + ' (' + err.status + ')', message: getText('aiBillingError', 'Your API account has insufficient credit. Check billing in the provider console. A chat subscription does not include API credit.') };
    const reasons = {
      model: ['aiModelError', 'The selected model is unavailable or your API account cannot access it. Choose another model in Settings.'],
      parameters: ['aiParameterError', 'The service rejected the model or reasoning settings. Try the Default reasoning level or another model.'],
      image: ['aiImageError', 'The service rejected an image because of its format or size. Try another photo or fewer photos.'],
    };
    if (reasons[err.reason]) return { title: provider + ' (' + err.status + ')', message: getText(...reasons[err.reason]) };
    if (err.provider === 'claude' && err.status === 400) return { title: provider + ' (400)', message: getText('aiBadRequestError', 'Claude rejected the request. The exact cause could not be identified. Check your API credit, selected model and reasoning setting. Try Default reasoning and a short text description.') };
    const key = [401, 403].includes(err.status) ? 'aiAuthError' : err.status === 429 ? 'aiQuotaError' : 'aiRequestError';
    return { title: provider + ' (' + err.status + ')', message: getText(key, 'Request failed. Check your API key, model and account quota.') };
  }

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
      message: getText('errServerBusyMsg', 'Skúste neskôr alebo iný model.')
    };
  }

  return { title: getText('errorTitle', 'Chyba'), message: msg };
}



// ... (BackendError class stays)

export async function analyzeFood(payload) {
  return analyzeWithProvider(payload);
}

export async function analyzeFoodDescriptionInput(payload) {
  return analyzeWithProvider(payload);
}

