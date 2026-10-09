// Unknown/custom models keep their API default until their capabilities are known.
export function reasoningLevels(provider, model = '') {
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
    const thinkingConfig = model.startsWith('gemini-3')
      ? { thinkingLevel: level }
      : { thinkingBudget: { none: 0, low: 1024, medium: 4096, high: 8192 }[level] };
    return { thinkingConfig, maxOutputTokens: 12000 };
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
