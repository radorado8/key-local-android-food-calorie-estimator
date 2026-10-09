# AI reasoning settings

Settings → AI provider → Reasoning level stores a preference per provider and model. New and existing users default to `default`, which omits thinking/effort parameters and preserves API model defaults. Unknown custom models have a disabled selector and no override is sent.

OpenAI: GPT-6 Luna/Sol, GPT-6.1 Sol, GPT-5.6 Luna/Terra/Sol, GPT-5.4 mini/nano and GPT-5/mini/nano use Responses `reasoning.effort`. GPT-6.1 Sol cannot use `none`. GPT-4.1 has no configurable reasoning.

Gemini: explicit supported Gemini 3 Flash and 3.1 Pro IDs use `generationConfig.thinkingConfig.thinkingLevel`. Mutable latest aliases keep Default because their target capabilities may change. Gemini 2.5 is removed from the built-in catalog; stored/custom IDs remain intact with Default only.

Claude: Sonnet/Opus 4.6 use adaptive thinking and output_config.effort; Haiku 4.5 uses explicit budgets (1024/4096/8192 tokens). Manual thinking uses automatic tool choice, with validated final JSON text accepted as a fallback. Thought blocks are never treated as nutrition results.

Higher reasoning levels can increase latency and cost. Output allowances include reasoning tokens; a truncated response is rejected, not saved as food. Voice transcription keeps its existing defaults; reasoning applies to the subsequent nutrition analysis.

## Validation (2026-10-09)

30 offline tests cover provider payloads, Default, unsupported settings, persistence across restart, voice routing, and search behavior. Exactly two live OpenAI requests on iPhone 17e simulator, GPT-6 Luna / low effort: 100 g apple text → Apple, 52 kcal, 2.71 s; orange photo → Orange, 47 kcal, 100 g, 2.17 s. No test meals were saved and no keys were logged.

Sources: https://developers.openai.com/api/docs/guides/deployment-checklist ; https://ai.google.dev/gemini-api/docs/generate-content/thinking ; https://platform.claude.com/docs/en/build-with-claude/thinking ; https://platform.claude.com/docs/en/build-with-claude/effort
