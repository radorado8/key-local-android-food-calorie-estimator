// A malformed analysis can be regenerated, but never retry credentials, billing,
// non-food results or cancellation. One shared limit avoids nested Gemini retries.
export async function retryAnalysis(operation, payload = {}) {
  const signal = payload.signal;
  const abort = () => {
    if (signal?.aborted) { const error = new Error('Aborted'); error.name = 'AbortError'; throw error; }
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    abort();
    try {
      const result = await operation();
      abort();
      return result;
    } catch (error) {
      abort();
      if (error.name === 'AbortError' || error.message === 'Aborted') throw error;
      const message = error.message || '';
      const malformed = /Invalid format from AI|Empty response|No candidates returned|Invalid JSON response|Unexpected end of (?:input|JSON)|JSON Parse error|Unexpected token/i.test(message);
      // Preserve the existing transient retries for Gemini photo analysis.
      const geminiPhoto = (!payload.aiProvider || payload.aiProvider === 'gemini')
        && (payload.base64Data || payload.images?.length);
      const transientPhoto = geminiPhoto && ([429, 503].includes(error.status)
        || /Network request failed|Server Busy/.test(message));
      if (attempt === 2 || (!malformed && !transientPhoto)) throw error;
    }
  }
}
