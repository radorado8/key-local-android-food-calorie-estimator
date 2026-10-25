// Model capabilities verified in the providers' thinking/effort documentation, 2026-10-24.
const modernClaude = model => /^claude-(?:(?:haiku|sonnet|opus)-5-5|fable-5-1)$/.test(model);
export function analysisModelConfig(provider, model) {
  if (provider === 'claude' && modernClaude(model)) return { max_tokens: 16000, tool_choice: { type: 'auto' } };
  if (provider === 'gemini' && model === 'gemini-4-argon') return { maxOutputTokens: 32768 };
  if (provider === 'gemini' && /^gemini-3\.(?:8-flash|6-flash|5-flash-lite|1-flash-lite|1-pro-preview)$/.test(model)) return { maxOutputTokens: 16000 };
  return {};
}

// Unknown/custom models keep their API default until their capabilities are known.
export function reasoningLevels(provider, model = '') {
  if (provider === 'claude' && modernClaude(model)) return ['default', ...(model === 'claude-haiku-5-5' ? ['none'] : []), 'low', 'medium', 'high', 'xhigh', 'max'];
  if (provider === 'gemini') {
    if (['gemini-4-argon', 'gemini-3.8-flash'].includes(model)) return ['default', 'low', 'medium', 'high'];
    if (['gemini-3.6-flash', 'gemini-3.5-flash-lite'].includes(model)) return ['default', 'minimal', 'low', 'medium', 'high'];
  }
  if (!/^(gpt-(6\.1-sol|6-luna|6-sol|5\.6-luna|5\.6-terra|5\.6-sol|5-mini|5-nano|5|5\.4-mini|5\.4-nano)|gemini-3-flash-preview|gemini-3\.1-pro-preview|claude-(haiku-4-5|sonnet-4-6|opus-4-6))(?:-\d{4}-?\d{2}-?\d{2})?$/.test(model)) return ['default'];
  if (provider === 'openai') {
    if (/^gpt-6\.1-sol(?:-|$)/.test(model)) return ['default', 'low', 'medium', 'high', 'xhigh', 'max'];
    if (/^gpt-(?:6-(?:luna|sol)|5\.6-(?:luna|terra|sol))(?:-|$)/.test(model)) return ['default', 'none', 'low', 'medium', 'high', 'xhigh', 'max'];
    if (/^gpt-5(?:-mini|-nano)?(?:-\d|$)/.test(model)) return ['default', 'minimal', 'low', 'medium', 'high'];
    if (/^gpt-5\.4-(?:mini|nano)(?:-|$)/.test(model)) return ['default', 'none', 'low', 'medium', 'high', 'xhigh'];
  }
  if (provider === 'gemini') {
    if (/^gemini-3.*flash/.test(model)) return ['default', 'minimal', 'low', 'medium', 'high'];
    if (/^gemini-3.*pro/.test(model)) return ['default', 'low', 'medium', 'high'];
  }
  if (provider === 'claude') {
    if (/^claude-(?:sonnet|opus)-4-6(?:-|$)/.test(model)) return ['default', 'none', 'low', 'medium', 'high', 'max'];
    if (/^claude-haiku-4-5(?:-|$)/.test(model)) return ['default', 'none', 'low', 'medium', 'high'];
  }
  return ['default'];
}
export function normalizeReasoning(provider, model, value) {
  return reasoningLevels(provider, model).includes(value) ? value : 'default';
}
export function reasoningConfig(provider, model, requested) {
  const level = normalizeReasoning(provider, model, requested);
  if (level === 'default') return {};
  if (provider === 'openai') return { reasoning: { effort: level }, max_output_tokens: 16000 };
  if (provider === 'gemini') {
    const thinkingConfig = { thinkingLevel: level };
    return { thinkingConfig, maxOutputTokens: Math.max(12000, analysisModelConfig(provider, model).maxOutputTokens || 0) };
  }
  if (provider === 'claude') {
    if (level === 'none') return { thinking: { type: 'disabled' } };
    if (model.startsWith('claude-haiku-4-5')) return {
      thinking: { type: 'enabled', budget_tokens: { low: 1024, medium: 4096, high: 8192 }[level] },
      max_tokens: 12000, tool_choice: { type: 'auto' },
    };
    return { thinking: { type: 'adaptive' }, output_config: { effort: level }, max_tokens: 16000 };
  }
  return {};
}
